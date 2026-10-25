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
          <div className="text-xs text-[#6B6B78]">
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
            <Loader2 className="w-7 h-7 animate-spin text-[#5B5CE2] mx-auto" />
            <p className="text-xs text-[#6B6B78]">Loading verified receipt record...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="p-6 text-center space-y-3">
            <AlertTriangle className="w-7 h-7 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-[#18181F]">{error}</p>
            <Button size="sm" variant="outline" onClick={loadReceiptData}>
              Retry
            </Button>
          </div>
        )}

        {receipt && !isLoading && (
          <>
            {/* Verified Badge Header */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#18181F]">
                    Payment Verified on Algorand
                  </div>
                  <div className="text-[11px] text-[#6B6B78]">
                    {receipt.payment.network}  •  {receipt.payment.paymentMethod}
                  </div>
                </div>
              </div>
              <Badge variant="green">{receipt.status}</Badge>
            </div>

            {/* Receipt Summary Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Customer Box */}
              <div className="p-3.5 rounded-xl border border-[#E8E8EF] bg-[#F7F7FB] space-y-2">
                <span className="text-[10px] font-bold text-[#34358F] uppercase tracking-wider">
                  Customer
                </span>
                <div className="space-y-1">
                  <div className="font-semibold text-[#18181F]">{receipt.customer.name}</div>
                  <div className="text-[#6B6B78] text-[11px]">{receipt.customer.email}</div>
                  <div className="font-mono text-[10px] text-[#6B6B78] pt-1 border-t border-[#E8E8EF]">
                    Wallet: {receipt.customer.maskedWalletAddress}
                  </div>
                </div>
              </div>

              {/* Plan Box */}
              <div className="p-3.5 rounded-xl border border-[#E8E8EF] bg-[#F7F7FB] space-y-2">
                <span className="text-[10px] font-bold text-[#34358F] uppercase tracking-wider">
                  Entitlements Unlocked
                </span>
                <div className="space-y-1">
                  <div className="font-semibold text-emerald-700">+{receipt.payment.attemptsUnlocked} Attempts</div>
                  <div className="text-[#18181F] text-[11px]">{receipt.payment.planName}</div>
                  <div className="text-[10px] text-[#6B6B78] pt-1 border-t border-[#E8E8EF]">
                    Access Tier: Permanent Unlocked Credit
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Amount Card */}
            <div className="rounded-xl border border-[#D6DAFF] bg-[#EEF0FF]/30 p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-[#6B6B78] uppercase tracking-wider">
                  Total Amount Paid
                </span>
                <div className="font-bold text-lg text-[#18181F]">
                  {receipt.payment.amountAlgo} {receipt.payment.currency}
                </div>
              </div>
              <div className="text-right text-[11px] text-[#6B6B78]">
                <div>Receipt: <strong className="text-[#18181F]">{receipt.receiptNumber}</strong></div>
                <div>Date: {receipt.dateFormatted}</div>
              </div>
            </div>

            {/* Blockchain Audit Box */}
            <div className="rounded-xl border border-[#E8E8EF] bg-white p-3.5 space-y-2">
              <span className="text-[10px] font-bold text-[#6B6B78] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#5B5CE2]" />
                On-Chain Verification Audit
              </span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#6B6B78]">Transaction ID:</span>
                  <span className="font-mono text-[10px] text-[#18181F] max-w-[240px] truncate" title={receipt.transaction.transactionId}>
                    {receipt.transaction.transactionId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B78]">Sender:</span>
                  <span className="font-mono text-[10px] text-[#18181F] max-w-[240px] truncate" title={receipt.transaction.sender}>
                    {receipt.transaction.sender}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B78]">Treasury Receiver:</span>
                  <span className="font-mono text-[10px] text-[#18181F] max-w-[240px] truncate" title={receipt.transaction.receiver}>
                    {receipt.transaction.receiver}
                  </span>
                </div>
                {receipt.transaction.blockchainRound && (
                  <div className="flex justify-between">
                    <span className="text-[#6B6B78]">Confirmed Block:</span>
                    <span className="font-mono text-[#18181F]">Round #{receipt.transaction.blockchainRound}</span>
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
