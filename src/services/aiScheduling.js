/**
 * AI Scheduling Service — Scaffold
 *
 * This service provides AI-assisted group scheduling for Gatherly events.
 * Full automation is deferred; this scaffold sets up config and prompt structure.
 */

/** AI Scheduling configuration (populated from environment/admin settings) */
export const aiConfig = {
  openaiApiKey: process.env.REACT_APP_OPENAI_API_KEY || '',
  model: 'gpt-4o-mini',
  maxTokens: 1000,
  schedulingPromptTemplate: `
You are an AI assistant for Gatherly, a social gathering platform.
Your task is to intelligently group event attendees into compatible sub-groups.

Given the following attendees array, recommend optimal groupings:

ATTENDEES:
{{attendees}}

CONSTRAINTS:
- Target group size: {{targetGroupSize}}
- Max groups: {{maxGroups}}
- Location limit per group: {{locationLimit}}

OUTPUT FORMAT (JSON):
{
  "groups": [
    {
      "groupId": 1,
      "memberIds": ["uid1", "uid2"],
      "compatibilityScore": 0.85,
      "suggestedVenue": "optional venue note"
    }
  ],
  "totalGroups": 2,
  "schedulingNotes": "brief explanation"
}

Consider:
1. Shared interests between attendees
2. Prior positive ratings between attendees
3. Even gender distribution if possible
4. First-time vs. repeat attendees balance
`.trim(),
};

/**
 * Build the scheduling prompt for a given set of attendees.
 * @param {Array} attendees - Array of attendee objects
 * @param {Object} constraints - Scheduling constraints
 * @param {number} constraints.targetGroupSize - Ideal group size
 * @param {number} constraints.maxGroups - Maximum number of groups
 * @param {number} constraints.locationLimit - Max people per location
 * @returns {string} The formatted prompt
 */
export function buildSchedulingPrompt(attendees, constraints = {}) {
  const {
    targetGroupSize = 10,
    maxGroups = Math.ceil(attendees.length / targetGroupSize),
    locationLimit = targetGroupSize,
  } = constraints;

  const attendeeSummaries = attendees.map(a => ({
    id: a.id,
    interests: a.preferences?.interests || '',
    gender: a.gender || 'unknown',
    city: a.city || '',
    priorEvents: a.priorEvents || 0,
    ratings: a.ratings || [],
  }));

  return aiConfig.schedulingPromptTemplate
    .replace('{{attendees}}', JSON.stringify(attendeeSummaries, null, 2))
    .replace('{{targetGroupSize}}', targetGroupSize)
    .replace('{{maxGroups}}', maxGroups)
    .replace('{{locationLimit}}', locationLimit);
}

/**
 * Run AI-assisted scheduling for an event's attendees.
 *
 * NOTE: This is a scaffold. Full OpenAI integration is deferred.
 * Currently returns a mock grouping for development/testing.
 *
 * @param {Array} attendees - Event attendees
 * @param {Object} constraints - Scheduling constraints
 * @returns {Promise<Object>} Scheduling result with groups
 */
export async function runScheduling(attendees, constraints = {}) {
  if (!aiConfig.openaiApiKey) {
    console.warn('[aiScheduling] No OpenAI API key configured. Using fallback grouping.');
    return fallbackGrouping(attendees, constraints);
  }

  try {
    const prompt = buildSchedulingPrompt(attendees, constraints);

    // Full OpenAI integration deferred - scaffold only
    // When ready, uncomment and implement:
    /*
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: aiConfig.maxTokens,
        response_format: { type: 'json_object' },
      }),
    });
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
    */

    console.log('[aiScheduling] Prompt built:', prompt.substring(0, 200) + '...');
    return fallbackGrouping(attendees, constraints);
  } catch (error) {
    console.error('[aiScheduling] Error running scheduling:', error);
    return fallbackGrouping(attendees, constraints);
  }
}

/**
 * Fallback grouping algorithm (no AI).
 * Splits attendees into roughly equal groups.
 * @param {Array} attendees
 * @param {Object} constraints
 * @returns {Object} Grouping result
 */
function fallbackGrouping(attendees, constraints = {}) {
  const { targetGroupSize = 10 } = constraints;
  const totalGroups = Math.ceil(attendees.length / targetGroupSize);
  const groups = [];

  for (let i = 0; i < totalGroups; i++) {
    const start = i * targetGroupSize;
    const end = start + targetGroupSize;
    const members = attendees.slice(start, end);

    groups.push({
      groupId: i + 1,
      memberIds: members.map(m => m.id),
      compatibilityScore: null,
      suggestedVenue: null,
    });
  }

  return {
    groups,
    totalGroups,
    schedulingNotes: 'Fallback sequential grouping (AI key not configured)',
  };
}
