# Migration Notes

## Current Status

- Native entrypoint is `App.js` (React Native / Expo).
- Legacy web app remains under `src/` for reference during migration.
- A subset of unreferenced legacy files was archived into `legacy-web/`.

## Archived Legacy Files

- `legacy-web/components/LoginForm.js`
- `legacy-web/components/RatingFlow.js`
- `legacy-web/services/aiScheduling.js`
- `legacy-web/algorithms/tableAssignment.js`
- `legacy-web/tests/App.test.js`
- `legacy-web/tests/setupTests.js`

## Active Scripts

- `npm start` -> `expo start`
- `npm run ios` -> `expo run:ios`
- `npm run android` -> `expo run:android`
- `npm run web` -> `expo start --web`
- `npm run legacy:web` -> `react-scripts start`
- `npm run legacy:build` -> `react-scripts build`
- `npm run legacy:test` -> `react-scripts test`

## Suggested Next Migration Step

1. Build native authentication flow (`AuthProvider` replacement with RN-compatible login).
2. Migrate `LandingPage` and `Dashboard` into React Native components.
3. Remove remaining DOM-based files after each screen is replaced.
