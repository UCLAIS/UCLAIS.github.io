/** Society-approved service guidance, kept separate from untrusted imported text. */
export const publicGuidance = {
  disclaimer: 'AI-generated answers may be incorrect or out of date. Check the cited sources and confirm important society details with the committee.',
  contact: {
    email: 'info@uclai.co.uk',
    url: 'mailto:info@uclai.co.uk',
    when: 'If approved sources cannot answer a question, conflict, are unavailable or out of date, or the question needs committee guidance or falls outside the library, explain the gap and ask the user to email info@uclai.co.uk. Do not guess or invent a society policy.',
  },
  contributions: {
    audience: 'UCL AI Society committee members with authorised GitHub repository access only.',
    workflow: 'Committee members prepare and review knowledge changes through authenticated GitHub access. Passing checks and merging to main publishes an update. The public MCP is read-only and does not grant editing or publishing permissions. Other readers should email corrections or suggestions to info@uclai.co.uk.',
    url: 'https://github.com/UCLAIS/UCLAIS.github.io/tree/main/knowledge',
  },
  values: {
    url: 'https://uclai.co.uk/about-us/#ethics-title',
    summary: 'UCL AI Society stands for accessible AI, student research and safe, ethical work, with attention to fairness, privacy, accountability and human creativity. Read the society’s eight principles on the About Us page.',
  },
} as const;
