import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider, useAppLocale } from '@/lib/i18n';
import { ApplianceDetectionSchema, localLabel, type ApplianceDetection } from '@/lib/vision';
import {
  DETECT_JSON_SCHEMA,
  DETECT_SYSTEM_PROMPT,
  parseDetections,
} from '@/server/perception/detect';
import { REGION_SYSTEM_PROMPT } from '@/server/perception/region-prompt';
import { MOCK_DETECTIONS } from '@/server/perception/mock';
import { DetectionCanvas, SelectedAppliance } from '../index';

const fridge: ApplianceDetection = {
  id: 'det-1',
  label: 'Refrigerator',
  labels: { fr: 'Réfrigérateur', mg: 'Vata fampangatsiahana' },
  category: 'fridge',
  box: { x: 0.1, y: 0.1, w: 0.2, h: 0.5 },
};
const drawn: ApplianceDetection = {
  id: 'shape-1',
  label: 'pompe du puits',
  category: 'other',
  manual: true,
  box: { x: 0.5, y: 0.5, w: 0.2, h: 0.2 },
};

afterEach(() => localStorage.clear());

describe('localized detection names', () => {
  it('model gives the name in EN + FR + MG; English stays the label (SAM prompt)', () => {
    const [d] = parseDetections(
      JSON.stringify({
        objects: [
          {
            label: 'Water pump',
            label_fr: ' Pompe à eau ',
            label_mg: 'Paompy rano',
            kind: 'appliance',
            category: 'water_pump',
            bbox: [0, 0, 500, 500],
          },
          { label: 'Tree', kind: 'scenery', scenery: 'tree', bbox: [0, 0, 10, 10] },
        ],
      })
    );
    expect(d).toMatchObject({
      label: 'Water pump',
      labels: { fr: 'Pompe à eau', mg: 'Paompy rano' },
    });
    expect(ApplianceDetectionSchema.parse(d)).toEqual(d);
    const tree = parseDetections(
      JSON.stringify({ objects: [{ label: 'Tree', kind: 'scenery', bbox: [0, 0, 10, 10] }] })
    )[0]!;
    expect(tree.labels).toBeUndefined();
    const props = (DETECT_JSON_SCHEMA.schema.properties.objects.items as { properties: object })
      .properties;
    expect(Object.keys(props)).toEqual(expect.arrayContaining(['label_fr', 'label_mg']));
    expect(DETECT_SYSTEM_PROMPT).toMatch(/French \(label_fr\).*Malagasy \(label_mg\)/);
    expect(REGION_SYSTEM_PROMPT).toMatch(/French \(label_fr\).*Malagasy \(label_mg\)/);
  });

  it('localLabel picks the page language, falls back to the label', () => {
    expect(localLabel(fridge, 'fr')).toBe('Réfrigérateur');
    expect(localLabel(fridge, 'mg')).toBe('Vata fampangatsiahana');
    expect(localLabel(fridge, 'en')).toBe('Refrigerator');
    expect(localLabel({ label: 'TV', labels: { fr: 'Télé' } }, 'mg')).toBe('TV');
    expect(localLabel(drawn, 'fr')).toBe('pompe du puits');
  });

  it('offline sample room is translated too', () => {
    for (const d of MOCK_DETECTIONS) {
      expect(d.labels?.fr).toBeTruthy();
      expect(d.labels?.mg).toBeTruthy();
    }
  });

  it('list, hover chip and selected line follow the language, live on switch', () => {
    let setLocale: (l: 'en' | 'fr' | 'mg') => void = () => {};
    function Grab() {
      setLocale = useAppLocale().setLocale;
      return null;
    }
    const { container } = render(
      <I18nProvider>
        <Grab />
        <DetectionCanvas
          imageUrl="data:x"
          status="ready"
          detections={[fridge, drawn]}
          selectedId="det-1"
          onSelect={() => {}}
        />
        <SelectedAppliance selected={fridge} />
      </I18nProvider>
    );
    expect(screen.getByRole('button', { name: /Refrigerator/ })).toBeTruthy();
    act(() => setLocale('fr'));
    expect(screen.getByRole('button', { name: /Réfrigérateur/ })).toBeTruthy();
    expect(screen.queryByText('Refrigerator')).toBeNull();
    // Same as its category name (« Réfrigérateur »): no repeated hint.
    expect(screen.getByText('Choisi : Réfrigérateur')).toBeTruthy();
    fireEvent.pointerEnter(container.querySelector('path[data-detection="det-1"]')!);
    expect(screen.getAllByText('Réfrigérateur').length).toBeGreaterThan(1);
    // The operator's own text is kept as typed.
    expect(screen.getByText('pompe du puits')).toBeTruthy();
    act(() => setLocale('mg'));
    expect(screen.getByRole('button', { name: /Vata fampangatsiahana/ })).toBeTruthy();
  });
});
