export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe',
  'Zamfara', 'FCT (Abuja)',
];

export const BANKS = [
  'Access Bank', 'Bank of Agriculture', 'Ecobank', 'FCMB', 'Fidelity Bank',
  'First Bank of Nigeria', 'FBNQuest', 'Globus Bank', 'Guaranty Trust Bank (GTBank)',
  'Jaiz Bank', 'Keystone Bank', 'Moniepoint', 'PalmPay', 'Polaris Bank',
  'Providus Bank', 'Signature Bank', 'Stanbic IBTC', 'Sterling Bank', 'SunTrust Bank',
  'Taj Bank', 'Union Bank of Nigeria', 'United Bank for Africa (UBA)', 'Unity Bank',
  'Wema Bank', 'Zenith Bank', 'Other bank', 'Fintech & MFB',
];

export const PROJECT_CATEGORIES = [
  'Roads & Infrastructure',
  'Water & Sanitation',
  'Energy & Lighting',
  'Education',
  'Health',
  'Housing & Real Estate',
  'Agriculture & Food',
  'Commerce & Industry',
  'ICT & Technology',
  'Security & Defence',
  'Environment & Cleanup',
  'Faith & Social',
  'Other',
];

export const STATUS_OPTIONS = [
  { value: 'registered', label: 'Registered' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'inactive', label: 'Inactive' },
];

/* ------------------------------------------------------------------------ */
/* Public self-registration: the fee the public pays by bank transfer, and   */
/* the account they pay into.                                                */
/* ------------------------------------------------------------------------ */

export const FEE_OPTIONS = [
  { value: 1000, label: '₦1,000', hint: 'Standard — one organization' },
  { value: 1500, label: '₦1,500', hint: 'Depending on the case' },
  { value: 500, label: '₦500', hint: 'To balance up' },
];

/**
 * The bank account the public transfers the fee to. Set these to the real
 * receiving account before launch — when the account number is empty the
 * public page shows a "details coming soon" notice instead of guessing
 * (never show a wrong receiving account — people pay real money into it).
 */
export const PUBLIC_TRANSFER = {
  bank: '',
  accountName: '',
  accountNumber: '',
};
