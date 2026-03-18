import React from 'react';
import { useTranslation } from 'react-i18next';

export const ALL_INTERESTS = [
  '🎬 Movie Night', '🎾 Padel', '✨ Soirée', '🍽️ Dinner',
  '☕ Coffee Meetup', '📚 Library Meetup', '🏓 Paddle',
  '🎮 Gaming', '🎨 Art', '🏃 Sports', '🎵 Music', '🍳 Cooking', '✈️ Travel',
];

/**
 * Shared interests toggle-chip editor.
 * Renders the predefined ALL_INTERESTS list as selectable chips.
 *
 * Props:
 *   interests {string[]}  – currently selected interests
 *   onChange  {function}  – called with updated interests array when a chip is toggled
 */
function InterestsEditor({ interests, onChange }) {
  const { t } = useTranslation();

  const toggleInterest = (interest) => {
    const updated = interests.includes(interest)
      ? interests.filter(i => i !== interest)
      : [...interests, interest];
    onChange(updated);
  };

  return (
    <div className="interests-tags">
      {ALL_INTERESTS.map(interest => (
        <span
          key={interest}
          className={`interest-tag${interests.includes(interest) ? ' selected' : ''}`}
          onClick={() => toggleInterest(interest)}
          role="checkbox"
          aria-checked={interests.includes(interest)}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleInterest(interest);
            }
          }}
          title={interests.includes(interest) ? t('removeInterest') : t('addInterest')}
        >
          {interest}
        </span>
      ))}
    </div>
  );
}

export default InterestsEditor;
