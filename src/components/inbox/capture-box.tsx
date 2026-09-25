'use client';

import { Mic, Square } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CAPTURE_FOCUS_EVENT } from '@/components/inbox/capture-hotkey';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { InboxInputKind } from '@/lib/inbox/types';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

function subscribeSpeech() {
  return () => undefined;
}

export function CaptureBox({
  onCapture,
  onManualTransaction,
  pending,
  autoFocus,
}: {
  onCapture: (input: {
    rawText: string;
    inputKind: InboxInputKind;
  }) => Promise<void>;
  onManualTransaction: (input: {
    amountMajor: number;
    date: string;
    merchant: string;
    type: 'expense' | 'income';
  }) => Promise<void>;
  pending: boolean;
  autoFocus?: boolean;
}) {
  const t = useTranslations('inbox');
  const locale = useLocale();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<InboxInputKind>('text');
  const [listening, setListening] = useState(false);
  const speechAvailable = useSyncExternalStore(
    subscribeSpeech,
    () => Boolean(getSpeechRecognition()),
    () => false,
  );
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [txnDate, setTxnDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [txnType, setTxnType] = useState<'expense' | 'income'>('expense');

  useEffect(() => {
    function focusCapture() {
      textareaRef.current?.focus();
    }
    window.addEventListener(CAPTURE_FOCUS_EVENT, focusCapture);
    if (autoFocus) {
      focusCapture();
    }
    return () => window.removeEventListener(CAPTURE_FOCUS_EVENT, focusCapture);
  }, [autoFocus]);

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function toggleVoice() {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      return;
    }
    if (listening) {
      stopListening();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = locale === 'ar' ? 'ar-SA' : 'en-SA';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setText((current) =>
          current ? `${current.trim()} ${transcript}` : transcript,
        );
        setKind('voice');
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  async function submitText() {
    const rawText = text.trim();
    if (!rawText || pending) {
      return;
    }
    const looksLikeLink = /^https?:\/\//i.test(rawText);
    await onCapture({
      rawText,
      inputKind: kind === 'text' && looksLikeLink ? 'link' : kind,
    });
    setText('');
    if (kind === 'voice') {
      setKind('text');
    }
  }

  async function submitManual() {
    const amountMajor = Number(amount);
    if (!Number.isFinite(amountMajor) || amountMajor <= 0 || pending) {
      return;
    }
    await onManualTransaction({
      amountMajor,
      date: txnDate,
      merchant: merchant.trim(),
      type: txnType,
    });
    setAmount('');
    setMerchant('');
  }

  return (
    <div className="rounded-2xl border border-primary/25 bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(
          [
            ['text', t('kindText')],
            ['link', t('kindLink')],
            ['note', t('kindNote')],
            ['manual_txn', t('kindMoney')],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={kind === value ? 'default' : 'outline'}
            onClick={() => setKind(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {kind === 'manual_txn' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="txn-amount">{t('amount')}</Label>
            <Input
              id="txn-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="txn-date">{t('date')}</Label>
            <Input
              id="txn-date"
              type="date"
              value={txnDate}
              onChange={(event) => setTxnDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="txn-merchant">{t('merchant')}</Label>
            <Input
              id="txn-merchant"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button
              type="button"
              variant={txnType === 'expense' ? 'default' : 'outline'}
              onClick={() => setTxnType('expense')}
            >
              {t('types.expense')}
            </Button>
            <Button
              type="button"
              variant={txnType === 'income' ? 'default' : 'outline'}
              onClick={() => setTxnType('income')}
            >
              {t('types.income')}
            </Button>
            <Button
              type="button"
              className="ms-auto"
              disabled={pending}
              onClick={() => void submitManual()}
            >
              {t('saveTransaction')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('placeholder')}
            className="min-h-28"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                void submitText();
              }
            }}
          />
          <div className="flex items-center gap-2">
            {speechAvailable ? (
              <Button
                type="button"
                variant={listening ? 'default' : 'outline'}
                size="sm"
                onClick={toggleVoice}
              >
                {listening ? <Square /> : <Mic />}
                {listening ? t('stopVoice') : t('voice')}
              </Button>
            ) : null}
            <p className="ms-auto text-xs text-muted-foreground">
              {t('shortcutHint')}
            </p>
            <Button
              type="button"
              disabled={pending || !text.trim()}
              onClick={() => void submitText()}
            >
              {t('capture')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
