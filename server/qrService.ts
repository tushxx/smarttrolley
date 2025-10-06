import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { storage } from './storage';

export class QRSessionService {
  
  // Generate QR code for cart session
  async generateCartSessionQR(userId: string): Promise<{ sessionId: string, qrCode: string }> {
    try {
      const sessionId = uuidv4();
      const sessionData = {
        sessionId,
        userId,
        timestamp: new Date().toISOString(),
        action: 'cart_login'
      };

      // Store session temporarily (expires in 5 minutes)
      await storage.createTempSession(sessionId, userId, 300); // 5 minutes

      // Generate QR code containing session data
      const qrData = JSON.stringify(sessionData);
      const qrCode = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 256,
        margin: 2
      });

      return { sessionId, qrCode };
      
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate cart session QR code');
    }
  }

  // Validate session from physical cart
  async validateCartSession(sessionId: string): Promise<{ valid: boolean, userId?: string }> {
    try {
      const session = await storage.getTempSession(sessionId);
      
      if (!session) {
        return { valid: false };
      }

      // Check if session has expired
      const now = new Date();
      const sessionTime = new Date(session.createdAt);
      const diffMinutes = (now.getTime() - sessionTime.getTime()) / (1000 * 60);
      
      if (diffMinutes > 5) { // 5 minute expiry
        await storage.deleteTempSession(sessionId);
        return { valid: false };
      }

      return { valid: true, userId: session.userId };
      
    } catch (error) {
      console.error('Error validating cart session:', error);
      return { valid: false };
    }
  }

  // Generate payment QR for checkout
  async generatePaymentQR(cartId: string, amount: number): Promise<string> {
    try {
      const paymentData = {
        type: 'payment',
        cartId,
        amount,
        currency: 'INR',
        timestamp: new Date().toISOString()
      };

      const qrCode = await QRCode.toDataURL(JSON.stringify(paymentData), {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 256,
        margin: 2
      });

      return qrCode;
      
    } catch (error) {
      console.error('Error generating payment QR:', error);
      throw new Error('Failed to generate payment QR code');
    }
  }

  // Generate store receipt QR
  async generateReceiptQR(orderId: string): Promise<string> {
    try {
      const receiptData = {
        type: 'receipt',
        orderId,
        timestamp: new Date().toISOString(),
        downloadUrl: `${process.env.BASE_URL}/api/receipt/${orderId}`
      };

      const qrCode = await QRCode.toDataURL(JSON.stringify(receiptData), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 200,
        margin: 2
      });

      return qrCode;
      
    } catch (error) {
      console.error('Error generating receipt QR:', error);
      throw new Error('Failed to generate receipt QR code');
    }
  }
}

export const qrService = new QRSessionService();