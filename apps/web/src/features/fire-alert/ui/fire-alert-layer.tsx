'use client';

import { useActiveFires, useFireSnackbars } from '../hooks/use-fire-alerts';
import { FireAlertBanner } from './fire-alert-banner';
import { FireSnackbars } from './fire-snackbars';

/** App-wide fire alarm: sticky big warning at the top of the page + automatic snackbars. */
export function FireAlertLayer() {
  const fires = useActiveFires();
  const { snackbars, dismiss } = useFireSnackbars(fires);
  return (
    <>
      {fires.length > 0 && (
        <div className="sticky top-0 z-20 -mx-3 -mt-3 sm:-mx-6 sm:-mt-6 mb-4 px-3 pt-3 sm:px-6 sm:pt-6 bg-canvas/80 backdrop-blur-sm">
          <FireAlertBanner fires={fires} />
        </div>
      )}
      <FireSnackbars items={snackbars} onDismiss={dismiss} />
    </>
  );
}
