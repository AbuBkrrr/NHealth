// services/payment.service.js
async function processPayment(userId, amount, type) {
  // Implementation using wallet or external gateway
  // For now, assume success
  return { success: true, method: 'wallet' };
}

module.exports = { processPayment };
