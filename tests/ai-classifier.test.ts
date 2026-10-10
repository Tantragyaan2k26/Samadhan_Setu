import { describe, it, expect } from 'vitest';
import { classifyComplaint } from '../lib/ai-classifier';

describe('AI Complaint Classifier', () => {
  it('should categorize Hindi water supply issue into Jal Sansthan department', async () => {
    const text = 'गांव में पिछले तीन दिनों से पीने का पानी नहीं आ रहा, पाइपलाइन लीकेज है।';
    const result = await classifyComplaint(text);

    expect(result.language).toBe('hi');
    expect(result.departmentCode).toBe('JAL_SANSTHAN');
    expect(result.categoryCode).toBe('WATER_SUPPLY_ISSUE');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should detect emergency landslide keywords and set urgency to EMERGENCY', async () => {
    const text = 'पहाड़ पर भारी भूस्खलन हुआ है और सड़क पर कई लोग मलबे में फंसे हैं!';
    const result = await classifyComplaint(text);

    expect(result.isEmergency).toBe(true);
    expect(result.urgency).toBe('EMERGENCY');
    expect(result.emergencyNotice).toContain('112');
  });

  it('should categorize English road pothole complaints into PWD', async () => {
    const text = 'Severe potholes and damaged road near Bhowali bend causing accidents.';
    const result = await classifyComplaint(text);

    expect(result.language).toBe('en');
    expect(result.departmentCode).toBe('PWD');
  });
});
