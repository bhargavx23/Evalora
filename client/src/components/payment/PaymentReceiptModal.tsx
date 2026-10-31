import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { triggerBlobDownload } from '../../utils/downloadFile';
import { useToast } from '../../context/ToastContext';
import {
  Download,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Wallet,
  AlertTriangle,
  Receipt
} from 'lucide-react';

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  transactionId
}) => {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && transactionId) {
      loadReceiptData();
    }
  }, [isOpen, transactionId]);

  const loadReceiptData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/payments/receipt/${transactionId}`);
      if (res.data?.success) {
        setReceipt(res.data.receipt);
      } else {
        setError(res.data?.message || 'Unable to retrieve payment receipt.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load receipt.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const res = await api.get(`/payments/receipt/${transactionId}/pdf`, {
        responseType: 'blob'
      });
      const filename = `Evalora-Payment-Receipt-${receipt?.receiptNumber || transactionId}.pdf`;
      triggerBlobDownload(res.data, filename);
      toast.success('Payment receipt PDF downloaded.');
    } catch {
      toast.error('Failed to download payment receipt PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Payment Receipt"
      description={receipt ? `Receipt No: ${receipt.receiptNumber}  •  Status: ${receipt.status}` : 'Verified Algorand Payment Receipt'}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-[#6E6E73]">
            {receipt ? `Verified on ${receipt.dateFormatted}` : ''}
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={onClose} size="sm">
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadPdf}
              isLoading={isDownloading}
              disabled={!receipt}
              icon={<Download className="w-4 h-4" />}
            >
              {isDownloading ? 'Generating PDF...' : 'Download Receipt (PDF)'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-xs">
        {isLoading && (
          <div className="py-12 text-center space-y-2">
            <Loader2 className="w-7 h-7 animate-spin text-[#007AFF] mx-auto" />
            <p className="text-xs text-[#6E6E73]">Loading verified receipt record...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="p-6 text-center space-y-3">
            <AlertTriangle className="w-7 h-7 text-[#8A7047] mx-auto" />
            <p className="text-sm font-semibold text-[#1D1D1F]">{error}</p>
            <Button size="sm" variant="outline" onClick={loadReceiptData}>
              Retry
            </Button>
          </div>
        )}

        {receipt && !isLoading && (
          <>
            {/* Verified Badge Header */}
            <div className="rounded-xl border border-[#C6DFD2] bg-[#E5F2EB]/70 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#E5F2EB] text-[#4C765D] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#1D1D1F]">
                    Payment Verified on Algorand
                  </div>
                  <div className="text-[11px] text-[#6E6E73]">
                    {receipt.payment.network}  •  {receipt.payment.paymentMethod}
                  </div>
                </div>
              </div>
              <Badge variant="green">{receipt.status}</Badge>
            </div>

            {/* Receipt Summary Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Customer Box */}
              <div className="p-3.5 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] space-y-2">
                <span className="text-[10px] font-bold text-[#0056CC] uppercase tracking-wider">
                  Customer
                </span>
                <div className="space-y-1">
                  <div className="font-semibold text-[#1D1D1F]">{receipt.customer.name}</div>
                  <div className="text-[#6E6E73] text-[11px]">{receipt.customer.email}</div>
                  <div className="font-mono text-[10px] text-[#6E6E73] pt-1 border-t border-[#D2D2D7]">
                    Wallet: {receipt.customer.maskedWalletAddress}
                  </div>
                </div>
              </div>

              {/* Plan Box */}
              <div className="p-3.5 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] space-y-2">
                <span className="text-[10px] font-bold text-[#0056CC] uppercase tracking-wider">
                  Entitlements Unlocked
                </span>
                <div className="space-y-1">
                  <div className="font-semibold text-[#4C765D]">+{receipt.payment.attemptsUnlocked} Attempts</div>
                  <div className="text-[#1D1D1F] text-[11px]">{receipt.payment.planName}</div>
                  <div className="text-[10px] text-[#6E6E73] pt-1 border-t border-[#D2D2D7]">
                    Access Tier: Permanent Unlocked Credit
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Amount Card */}
            <div className="rounded-xl border border-[#CFE2DC] bg-[#E5F1FF]/30 p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider">
                  Total Amount Paid
                </span>
                <div className="font-bold text-lg text-[#1D1D1F]">
                  {receipt.payment.amountAlgo} {receipt.payment.currency}
                </div>
              </div>
              <div className="text-right text-[11px] text-[#6E6E73]">
                <div>Receipt: <strong className="text-[#1D1D1F]">{receipt.receiptNumber}</strong></div>
                <div>Date: {receipt.dateFormatted}</div>
              </div>
            </div>

            {/* Blockchain Audit Box */}
            <div className="rounded-xl border border-[#D2D2D7] bg-white p-3.5 space-y-2">
              <span className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#007AFF]" />
                On-Chain Verification Audit
              </span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#6E6E73]">Transaction ID:</span>
                  <span className="font-mono text-[10px] text-[#1D1D1F] max-w-[240px] truncate" title={receipt.transaction.transactionId}>
                    {receipt.transaction.transactionId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E6E73]">Sender:</span>
                  <span className="font-mono text-[10px] text-[#1D1D1F] max-w-[240px] truncate" title={receipt.transaction.sender}>
                    {receipt.transaction.sender}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E6E73]">Treasury Receiver:</span>
                  <span className="font-mono text-[10px] text-[#1D1D1F] max-w-[240px] truncate" title={receipt.transaction.receiver}>
                    {receipt.transaction.receiver}
                  </span>
                </div>
                {receipt.transaction.blockchainRound && (
                  <div className="flex justify-between">
                    <span className="text-[#6E6E73]">Confirmed Block:</span>
                    <span className="font-mono text-[#1D1D1F]">Round #{receipt.transaction.blockchainRound}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
