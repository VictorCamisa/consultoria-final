import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Send, Loader2, Mic, MicOff, Paperclip, Smile, X, Check, CheckCheck,
  Image as ImageIcon, FileText, File,
} from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";

interface ChatInputBarProps {
  mensagem: string;
  setMensagem: (v: string) => void;
  onSendText: () => void;
  onSendMedia: (mediaUrl: string, mediaType: string, fileName: string) => void;
  loadingSend: boolean;
  prospectId: string;
}

export function ChatInputBar({
  mensagem,
  setMensagem,
  onSendText,
  onSendMedia,
  loadingSend,
  prospectId,
}: ChatInputBarProps) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    if (showEmoji) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmoji]);

  const handleEmojiClick = (emojiData: any) => {
    setMensagem(mensagem + emojiData.emoji);
    inputRef.current?.focus();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await uploadAndSendMedia(audioBlob, "audio/webm", "audio.webm", "audio");
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível acessar o microfone", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const uploadAndSendMedia = async (blob: Blob, mimeType: string, fileName: string, mediaType: string) => {
    setUploading(true);
    try {
      const ext = fileName.split(".").pop() || "bin";
      const path = `${prospectId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("whatsapp-media").upload(path, blob, {
        contentType: mimeType,
      });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      onSendMedia(urlData.publicUrl, mediaType, fileName);
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mediaType = file.type.startsWith("image") ? "image" : file.type.startsWith("video") ? "video" : "document";
    await uploadAndSendMedia(file, file.type, file.name, mediaType);
    e.target.value = "";
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (mensagem.trim()) onSendText();
    }
  };

  if (isRecording) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-[#f0f2f5]">
        <button onClick={cancelRecording} className="text-red-500 hover:text-red-600">
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm text-muted-foreground font-mono">{formatTime(recordingTime)}</span>
        </div>
        <button onClick={stopRecording} className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center hover:bg-[#22c55e]">
          <Send className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {showEmoji && (
        <div ref={emojiRef} className="absolute bottom-full left-0 z-50 mb-2">
          <EmojiPicker
            theme={Theme.LIGHT}
            onEmojiClick={handleEmojiClick}
            width={320}
            height={350}
            searchPlaceholder="Buscar emoji..."
          />
        </div>
      )}
      <div className="flex items-end gap-1.5 px-3 py-2 bg-[#f0f2f5]">
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-[#54656f] hover:text-[#3b4a54] transition-colors"
        >
          <Smile className="h-5 w-5" />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-[#54656f] hover:text-[#3b4a54] transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem"
            rows={1}
            className="w-full resize-none rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-[#111b21] placeholder:text-[#8696a0] focus:outline-none focus:ring-0 max-h-[120px] min-h-[40px]"
            style={{ overflow: "auto" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
        </div>

        {mensagem.trim() ? (
          <button
            onClick={onSendText}
            disabled={loadingSend}
            className="shrink-0 w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center hover:bg-[#22c55e] transition-colors disabled:opacity-50"
          >
            {loadingSend ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        ) : (
          <button
            onClick={startRecording}
            className="shrink-0 w-10 h-10 rounded-full text-[#54656f] hover:text-[#3b4a54] flex items-center justify-center transition-colors"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

interface ChatBubbleProps {
  msg: {
    id: string;
    direcao: string;
    conteudo: string;
    created_at: string | null;
  };
  prospectName: string;
  profilePhoto?: string | null;
}

export function ChatBubble({ msg, prospectName, profilePhoto }: ChatBubbleProps) {
  const isSent = msg.direcao === "saida";
  const time = msg.created_at
    ? new Date(msg.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`flex ${isSent ? "justify-end" : "justify-start"} mb-1 gap-1.5`}>
      {!isSent && (
        profilePhoto ? (
          <img src={profilePhoto} alt={prospectName} className="w-7 h-7 rounded-full object-cover shrink-0 mt-auto" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-[#dfe5e7] flex items-center justify-center shrink-0 mt-auto">
            <span className="text-[10px] font-bold text-[#54656f]">{prospectName.charAt(0).toUpperCase()}</span>
          </div>
        )
      )}
      <div
        className={`relative max-w-[65%] rounded-lg px-3 py-1.5 text-[13.6px] leading-[19px] shadow-sm ${
          isSent
            ? "bg-[#d9fdd3] text-[#111b21] rounded-tr-none"
            : "bg-white text-[#111b21] rounded-tl-none"
        }`}
      >
        {/* WhatsApp tail */}
        <div
          className={`absolute top-0 w-2 h-3 ${
            isSent
              ? "right-[-8px] text-[#d9fdd3]"
              : "left-[-8px] text-white"
          }`}
        >
          <svg viewBox="0 0 8 13" width="8" height="13">
            {isSent ? (
              <path fill="currentColor" d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
            ) : (
              <path fill="currentColor" d="M6.467 3.568 0 12.193V1h5.188c1.77 0 2.338 1.156 1.28 2.568z" />
            )}
          </svg>
        </div>

        {!isSent && (
          <p className="text-[12.8px] font-medium text-[#1fa855] mb-0.5">{prospectName}</p>
        )}
        <p className="whitespace-pre-wrap break-words">
          {msg.conteudo}
          {/* Spacer for timestamp */}
          <span className="inline-block w-[68px]" />
        </p>
        <span className={`float-right text-[11px] mt-[-14px] ml-2 flex items-center gap-0.5 ${
          isSent ? "text-[#667781]" : "text-[#667781]"
        }`}>
          {time}
          {isSent && <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] ml-0.5" />}
        </span>
      </div>
    </div>
  );
}
