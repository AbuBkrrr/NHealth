import { prisma } from '../config/prisma';

/**
 * Seeds reference catalogues on first boot (only when empty) so a fresh deployment is usable immediately.
 * Admins manage these afterwards from the admin panel (/api/admin-ops/catalog/*).
 */
export async function ensureReferenceData() {
  if ((await prisma.insurancePlan.count()) === 0) {
    await prisma.insurancePlan.createMany({ data: [
      { name: 'NHIA Formal Sector', provider: 'National Health Insurance Authority', type: 'NHIS', monthlyPremium: 0, description: 'Employer-sponsored national scheme. Link your existing NHIA number.', coverage: ['Outpatient care', 'Basic lab tests', 'Maternity', 'Essential drugs'] },
      { name: 'Basic Care', provider: 'Partner HMO', type: 'HMO', monthlyPremium: 3500, description: 'Affordable primary care for individuals.', coverage: ['GP consultations', 'Malaria & typhoid treatment', 'Basic lab tests', 'Generic drugs'] },
      { name: 'Family Plus', provider: 'Partner HMO', type: 'HMO', monthlyPremium: 12000, description: 'Covers up to 6 family members.', coverage: ['Specialist referrals', 'Maternity & child care', 'Admissions (10 days/yr)', 'Dental & optical basics'] },
      { name: 'Premium Gold', provider: 'Partner Insurer', type: 'PRIVATE', monthlyPremium: 35000, description: 'Comprehensive private cover with wide hospital network.', coverage: ['Unlimited consultations', 'Surgery', 'Admissions', 'Emergency evacuation', 'Chronic disease management'] },
      { name: 'Community Micro-Health', provider: 'Community Health Fund', type: 'MICRO', monthlyPremium: 1000, description: 'Low-cost cover for informal workers and rural communities.', coverage: ['Primary care', 'Malaria treatment', 'Antenatal visits'] },
    ] });
  }
  if ((await prisma.donationCenter.count()) === 0) {
    await prisma.donationCenter.createMany({ data: [
      { name: 'National Blood Service Commission - Lagos', type: 'BLOOD', address: 'Old Secretariat, Yaba', city: 'Lagos', state: 'Lagos', phone: '+2348000000001', hours: 'Mon-Fri 8am-4pm', lat: 6.5095, lng: 3.3711 },
      { name: 'LUTH Blood Bank', type: 'BOTH', address: 'Idi-Araba, Surulere', city: 'Lagos', state: 'Lagos', phone: '+2348000000002', hours: '24 hours', lat: 6.5177, lng: 3.3536 },
      { name: 'National Hospital Blood Bank', type: 'BOTH', address: 'Central Business District', city: 'Abuja', state: 'FCT', phone: '+2348000000003', hours: '24 hours', lat: 9.0412, lng: 7.4797 },
      { name: 'UCH Ibadan Blood Bank', type: 'BLOOD', address: 'Queen Elizabeth Rd', city: 'Ibadan', state: 'Oyo', phone: '+2348000000004', hours: 'Mon-Sat 8am-6pm', lat: 7.4011, lng: 3.9036 },
    ] });
  }
  if ((await prisma.healthArticle.count()) === 0) {
    await prisma.healthArticle.createMany({ data: [
      { slug: 'malaria-prevention', title: 'Preventing malaria at home', category: 'Prevention', summary: 'Simple steps that cut your family\'s malaria risk.', body: 'Sleep under insecticide-treated nets every night. Remove standing water around your home weekly. Use repellent at dusk. Seek a test within 24 hours of fever - do not self-treat without testing. Pregnant women and children under 5 should see a provider immediately for any fever.' },
      { slug: 'know-your-genotype', title: 'Why knowing your genotype matters', category: 'Genetics', summary: 'Genotype testing before marriage prevents sickle cell disease in children.', body: 'Genotypes are AA, AS, AC, SS, SC. Two carriers (AS + AS) have a 1 in 4 chance per pregnancy of a child with sickle cell disease. Book a genotype test in Labs and record the result in your profile so your providers can advise you.' },
      { slug: 'blood-donation-basics', title: 'Blood donation: what to expect', category: 'Donation', summary: 'Healthy adults can safely donate every 8 weeks.', body: 'You must be 18-65, weigh at least 50 kg and feel well. Eat and drink water before donating. The process takes about 10 minutes. Avoid heavy lifting for the rest of the day. One donation can save up to three lives.' },
      { slug: 'hypertension-control', title: 'Living well with high blood pressure', category: 'Chronic care', summary: 'Daily habits that keep your blood pressure in range.', body: 'Take your medication at the same time every day - set a reminder in the app. Reduce salt, processed food and alcohol. Walk 30 minutes most days. Check your blood pressure weekly and share readings with your doctor through Messages.' },
      { slug: 'first-aid-emergencies', title: 'First aid while help is on the way', category: 'Emergency', summary: 'What to do in the minutes before an ambulance arrives.', body: 'Call 112 and request help in the app. Keep the person still if you suspect a spinal injury. Apply firm pressure to bleeding. For an unresponsive person who is not breathing normally, start chest compressions: hard and fast in the centre of the chest, 100-120 per minute.' },
    ] });
  }
}
