import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import { PaymentTransaction, IPaymentTransaction } from '../../models/PaymentTransaction.js';
import { PaymentIntent } from '../../models/PaymentIntent.js';
import { User } from '../../models/User.js';
import { algorandService } from '../algorandService.js';
import {
  PDF_COLORS,
  drawHeaderBanner,
  drawSectionHeading,
  drawPageFooters
} from './sharedTheme.js';

export interface PaymentReceiptData {
  receiptNumber: string;
  transactionId: string;
  paymentIntentId?: string;
  dateFormatted: string;
  timestamp: string;
  status: 'VERIFIED';
  customer: {
    name: string;
    email: string;
    walletAddress: string;
    maskedWalletAddress: string;
  };
  payment: {
    planName: string;
    attemptsUnlocked: number;
    amountAlgo: number;
    amountMicroAlgos: number;
    currency: 'ALGO';
    paymentMethod: string;
    network: string;
  };
  transaction: {
    transactionId: string;
    sender: string;
    receiver: string;
    blockchainRound?: number;
    verificationStatus: 'Verified';
  };
}

export class PaymentReceiptService {
  /**
   * Generates a collision-safe, unique receipt number.
   * Format: EV-YYYY-XXXXXX (e.g. EV-2026-F9A2B4)
   */
  generateReceiptNumber(): string {
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `EV-${year}-${randomHex}`;
  }

  /**
   * Loads verified payment transaction and compiles receipt data.
   * Strictly enforces that transaction must be VERIFIED on Algorand.
   */
  async compileReceiptData(
    transactionIdOrId: string,
    requestingUserId: string,
    isAdmin: boolean = false
  ): Promise<PaymentReceiptData> {
    const isObjectId = mongoose.Types.ObjectId.isValid(transactionIdOrId);
    const filter: any = {
      $or: [
        { transactionId: transactionIdOrId },
        { receiptNumber: transactionIdOrId }
      ]
    };
    if (isObjectId) {
      filter.$or.push({ _id: new mongoose.Types.ObjectId(transactionIdOrId) });
    }

    let tx = await PaymentTransaction.findOne(filter);
    if (!tx) {
      throw { statusCode: 404, message: 'Payment transaction record not found.', code: 'NOT_FOUND' };
    }

    // Security check: only transaction owner or platform admin can view/download
    if (!isAdmin && tx.userId.toString() !== requestingUserId) {
      throw { statusCode: 403, message: 'Access denied. You do not own this payment record.', code: 'FORBIDDEN' };
    }

    // Strictly enforce that receipt is only issued for backend-verified payments
    if (tx.status !== 'verified') {
      throw {
        statusCode: 400,
        message: `Cannot generate receipt for unverified transaction (current status: ${tx.status}).`,
        code: 'PAYMENT_NOT_VERIFIED'
      };
    }

    // Assign server-side receiptNumber if not already assigned
    if (!tx.receiptNumber) {
      tx.receiptNumber = this.generateReceiptNumber();
      await tx.save();
    }

    const user = await User.findById(tx.userId).select('name email walletAddress').lean();
    const customerName = user?.name || 'Valued Candidate';
    const customerEmail = user?.email || 'student@evalora.io';

    // Retrieve plan details
    let planName = `${tx.attemptsUnlocked} Additional Practice Attempts`;
    if (tx.paymentIntentId) {
      const intent = await PaymentIntent.findOne({ intentId: tx.paymentIntentId }).lean();
      if (intent?.planName) {
        planName = `${intent.planName} (+${tx.attemptsUnlocked} Attempts)`;
      }
    }

    const rawSender = tx.walletAddress || user?.walletAddress || 'unknown';
    const maskedSender =
      rawSender.length > 16
        ? `${rawSender.slice(0, 8)}...${rawSender.slice(-8)}`
        : rawSender;

    const activeNetwork = algorandService.getActiveNetwork();
    const networkDisplay =
      activeNetwork.toLowerCase() === 'mainnet' ? 'Algorand MainNet' : 'Algorand TestNet';

    const verifiedDate = tx.verifiedAt || tx.createdAt || new Date();
    const dateFormatted = new Date(verifiedDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    return {
      receiptNumber: tx.receiptNumber,
      transactionId: tx.transactionId,
      paymentIntentId: tx.paymentIntentId,
      dateFormatted,
      timestamp: new Date(verifiedDate).toISOString(),
      status: 'VERIFIED',
      customer: {
        name: customerName,
        email: customerEmail,
        walletAddress: rawSender,
        maskedWalletAddress: maskedSender
      },
      payment: {
        planName,
        attemptsUnlocked: tx.attemptsUnlocked,
        amountAlgo: tx.amount,
        amountMicroAlgos: tx.amountMicroAlgos || Math.round(tx.amount * 1_000_000),
        currency: 'ALGO',
        paymentMethod: 'Pera Wallet',
        network: networkDisplay
      },
      transaction: {
        transactionId: tx.transactionId,
        sender: rawSender,
        receiver: tx.receiverAddress || algorandService.getTreasuryWallet(),
        blockchainRound: tx.blockchainRound,
        verificationStatus: 'Verified'
      }
    };
  }

  /**
   * Generates a single-page, pixel-perfect vector PDF payment receipt.
   */
  async generatePdf(data: PaymentReceiptData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `Evalora Payment Receipt - ${data.receiptNumber}`,
          Author: 'Evalora Assessment Platform',
          Subject: 'Official Algorand Payment Receipt'
        }
      });

      const buffers: Buffer[] = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const margin = 40;
      const contentWidth = doc.page.width - margin * 2;

      // 1. Header Banner
      drawHeaderBanner(doc, {
        kicker: 'Official Payment Receipt',
        title: 'PAYMENT RECEIPT',
        subtitle: 'Secure payment independently verified on Algorand blockchain.',
        metaLines: [
          { label: 'Receipt No', value: data.receiptNumber },
          { label: 'Date', value: data.dateFormatted },
          { label: 'Status', value: data.status },
          { label: 'Method', value: data.payment.paymentMethod }
        ]
      });

      // 2. Verified Status Badge Box
      const badgeY = doc.y;
      doc.save();
      doc
        .roundedRect(margin, badgeY, contentWidth, 42, 6)
        .fillAndStroke(PDF_COLORS.successBg, '#A7F3D0');

      // Checkmark icon indicator
      doc
        .circle(margin + 22, badgeY + 21, 10)
        .fill(PDF_COLORS.success);

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(PDF_COLORS.success)
        .text('PAYMENT VERIFIED ON ALGORAND', margin + 42, badgeY + 11);

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(PDF_COLORS.dark)
        .text(
          `On-chain transaction ${data.transaction.transactionId.slice(0, 16)}... confirmed on ${data.payment.network}.`,
          margin + 42,
          badgeY + 25
        );
      doc.restore();

      doc.y = badgeY + 54;

      // 3. Customer & Billing Details (Two Columns)
      drawSectionHeading(doc, 'Customer & Entitlement Details');

      const colWidth = (contentWidth - 16) / 2;
      const detailsY = doc.y;

      // Left Box: Customer Info
      doc.save();
      doc
        .roundedRect(margin, detailsY, colWidth, 90, 6)
        .fillAndStroke(PDF_COLORS.lightBg, PDF_COLORS.borderSubtle);

      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(PDF_COLORS.primaryDark)
        .text('CUSTOMER INFORMATION', margin + 12, detailsY + 10, { characterSpacing: 0.5 });

      let leftY = detailsY + 26;
      const leftRows = [
        { label: 'Name', val: data.customer.name },
        { label: 'Email', val: data.customer.email },
        { label: 'Wallet', val: data.customer.maskedWalletAddress }
      ];

      for (const row of leftRows) {
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor(PDF_COLORS.textSecondary)
          .text(`${row.label}:`, margin + 12, leftY, { width: 50 });

        doc
          .fontSize(8)
          .font('Helvetica-Bold')
          .fillColor(PDF_COLORS.dark)
          .text(row.val, margin + 64, leftY, { width: colWidth - 76, ellipsis: true });
        leftY += 18;
      }
      doc.restore();

      // Right Box: Payment Plan Details
      const rightX = margin + colWidth + 16;
      doc.save();
      doc
        .roundedRect(rightX, detailsY, colWidth, 90, 6)
        .fillAndStroke(PDF_COLORS.lightBg, PDF_COLORS.borderSubtle);

      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(PDF_COLORS.primaryDark)
        .text('PLAN & ENTITLEMENTS', rightX + 12, detailsY + 10, { characterSpacing: 0.5 });

      let rightY = detailsY + 26;
      const rightRows = [
        { label: 'Plan', val: data.payment.planName },
        { label: 'Attempts Unlocked', val: `+${data.payment.attemptsUnlocked} Practice Sessions` },
        { label: 'Access Tier', val: 'Permanent Unlocked Credit' }
      ];

      for (const row of rightRows) {
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor(PDF_COLORS.textSecondary)
          .text(`${row.label}:`, rightX + 12, rightY, { width: 90 });

        doc
          .fontSize(8)
          .font('Helvetica-Bold')
          .fillColor(PDF_COLORS.dark)
          .text(row.val, rightX + 104, rightY, { width: colWidth - 116, ellipsis: true });
        rightY += 18;
      }
      doc.restore();

      doc.y = detailsY + 102;

      // 4. Line Item / Payment Amount Summary Table
      drawSectionHeading(doc, 'Payment Summary');

      const tableHeaders = [
        { title: 'Description', key: 'desc', width: 260 },
        { title: 'Rate', key: 'rate', width: 85, align: 'center' as const },
        { title: 'Currency', key: 'curr', width: 75, align: 'center' as const },
        { title: 'Total Amount', key: 'total', width: 95, align: 'right' as const }
      ];

      const tableData = [
        {
          desc: data.payment.planName,
          rate: `${data.payment.amountAlgo} ALGO`,
          curr: 'ALGO',
          total: `${data.payment.amountAlgo} ALGO`
        }
      ];

      const startTableY = doc.y;
      doc.save();
      // Table Header
      doc
        .roundedRect(margin, startTableY, contentWidth, 22, 4)
        .fill(PDF_COLORS.brandPurpleLight);

      let currentX = margin;
      for (const col of tableHeaders) {
        doc
          .fontSize(8)
          .font('Helvetica-Bold')
          .fillColor(PDF_COLORS.primaryDark)
          .text(col.title.toUpperCase(), currentX + 6, startTableY + 6, {
            width: col.width - 12,
            align: col.align || 'left',
            characterSpacing: 0.5
          });
        currentX += col.width;
      }

      // Row
      const rowY = startTableY + 22;
      doc
        .rect(margin, rowY, contentWidth, 26)
        .fill(PDF_COLORS.lightBg);

      currentX = margin;
      for (const col of tableHeaders) {
        doc
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .fillColor(PDF_COLORS.dark)
          .text(String(tableData[0][col.key as keyof typeof tableData[0]]), currentX + 6, rowY + 8, {
            width: col.width - 12,
            align: col.align || 'left'
          });
        currentX += col.width;
      }

      // Border bottom
      doc
        .strokeColor(PDF_COLORS.borderSubtle)
        .lineWidth(0.5)
        .moveTo(margin, rowY + 26)
        .lineTo(margin + contentWidth, rowY + 26)
        .stroke();

      // Total Callout
      const totalY = rowY + 34;
      doc
        .roundedRect(margin + contentWidth - 210, totalY, 210, 42, 6)
        .fillAndStroke(PDF_COLORS.brandPurpleLight, PDF_COLORS.borderAccent);

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(PDF_COLORS.primaryDark)
        .text('TOTAL PAID:', margin + contentWidth - 198, totalY + 14);

      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor(PDF_COLORS.primary)
        .text(`${data.payment.amountAlgo} ALGO`, margin + contentWidth - 198, totalY + 11, {
          width: 186,
          align: 'right'
        });

      doc.restore();
      doc.y = totalY + 54;

      // 5. Blockchain Transaction Audit Trail
      drawSectionHeading(doc, 'Blockchain Verification & Audit Trail');

      const auditBoxY = doc.y;
      doc.save();
      doc
        .roundedRect(margin, auditBoxY, contentWidth, 106, 6)
        .fillAndStroke(PDF_COLORS.lightBg, PDF_COLORS.borderSubtle);

      let trailY = auditBoxY + 10;
      const trailItems = [
        { label: 'Transaction ID', val: data.transaction.transactionId },
        { label: 'Network', val: data.payment.network },
        { label: 'Sender Address', val: data.transaction.sender },
        { label: 'Receiver Treasury Address', val: data.transaction.receiver },
        {
          label: 'Confirmation Status',
          val: `Confirmed on Algorand Ledger${data.transaction.blockchainRound ? ` (Round ${data.transaction.blockchainRound})` : ''}`
        }
      ];

      for (const item of trailItems) {
        doc
          .fontSize(7.5)
          .font('Helvetica-Bold')
          .fillColor(PDF_COLORS.textSecondary)
          .text(`${item.label}:`, margin + 12, trailY, { width: 140 });

        doc
          .fontSize(7.5)
          .font('Helvetica')
          .fillColor(PDF_COLORS.dark)
          .text(item.val, margin + 155, trailY, { width: contentWidth - 165, ellipsis: true });
        trailY += 18;
      }
      doc.restore();

      doc.y = auditBoxY + 116;

      // Security Notice Footer note
      doc
        .fontSize(7.5)
        .font('Helvetica')
        .fillColor(PDF_COLORS.textMuted)
        .text(
          'Notice: This receipt serves as cryptographic proof of purchase on the Algorand blockchain network. All fees and transactions are immutable and independently verifiable via any standard Algorand indexer or block explorer.',
          margin,
          doc.y,
          { width: contentWidth, align: 'center' }
        );

      // Draw page footer with receipt number
      drawPageFooters(doc, {
        documentId: data.receiptNumber,
        documentType: 'PAYMENT RECEIPT'
      });

      doc.end();
    });
  }
}

export const paymentReceiptService = new PaymentReceiptService();
