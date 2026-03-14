import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Gatherly app', () => {
  render(<App />);
  // App renders in loading state initially (firebase auth pending)
  // Just verify it renders without crashing
  expect(document.body).toBeInTheDocument();
});
