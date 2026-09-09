"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLearner } from "@/hooks/use-learner";
import { api, streamMentorMessage } from "@/lib/client-api";
import { markdownToHtml } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { Send, Loader2, BrainCircuit, MessageSquare } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function MentorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { learnerId, setLearnerId, hydrated } = useLearner();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [socratic, setSocratic] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!learnerId) {
      router.push("/onboarding");
      return;
    }
    api
      .getMentorHistory(learnerId)
      .then((res) => setHistory(res.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))))
      .catch(() => {
        /* empty history is fine */
      })
      .finally(() => setLoading(false));
  }, [hydrated, learnerId, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streamText]);

  const send = useCallback(async () => {
    if (!input.trim() || !learnerId || streaming) return;
    const message = input.trim();
    setInput("");
    setHistory((h) => [...h, { role: "user", content: message }]);
    setStreaming(true);
    setStreamText("");
    try {
      await streamMentorMessage(
        learnerId,
        message,
        socratic,
        (delta) => setStreamText((t) => t + delta),
      );
      setStreamText("");
      // Reload persisted history (assistant message is stored server-side).
      const res = await api.getMentorHistory(learnerId);
      setHistory(res.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    } catch (e) {
      setStreamText("");
      setHistory((h) => [...h, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Stream failed — try again."}` }]);
    } finally {
      setStreaming(false);
    }
  }, [input, learnerId, streaming, socratic]);

  if (!hydrated || loading) {
    return (
      <AppShell>
        <Skeleton className="h-[600px] rounded-xl" />
      </AppShell>
    );
  }

  return (
    <AppShell learnerName={null} onReset={() => { setLearnerId(null); router.push("/onboarding"); }}>
      <div className="max-w-3xl mx-auto">
        <Card className="glass-card flex flex-col" style={{ height: "min(74vh, 700px)" }}>
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-primary" /> Nexus — your mentor
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Socratic</span>
                <Switch checked={socratic} onCheckedChange={setSocratic} />
                <Badge variant="secondary" className="text-[10px]">
                  {socratic ? "guides" : "answers"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto thin-scroll p-4 space-y-4">
            {history.length === 0 && !streaming && (
              <div className="text-center py-10">
                <MessageSquare className="h-10 w-10 text-primary/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Ask Nexus anything about your path, your skills, your goal.
                  She&apos;s grounded in your real profile and progress.
                </p>
                <div className="mt-4 grid gap-2 max-w-md mx-auto text-left">
                  {[
                    "Why am I learning statistics before data science?",
                    "Give me a stretch project idea for this phase.",
                    "I'm stuck — explain this concept simply.",
                    "What's the honest gap between me and my goal?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="rounded-lg border border-border/60 p-2.5 text-xs hover:bg-secondary/60 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {history.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground whitespace-pre-wrap">
                    {m.content}
                  </div>
                ) : (
                  <div
                    className="max-w-[85%] rounded-2xl rounded-bl-md bg-secondary px-4 py-2.5 text-sm leading-relaxed text-foreground [&_pre]:overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(m.content) }}
                  />
                )}
              </div>
            ))}
            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-secondary px-4 py-2.5 text-sm leading-relaxed text-foreground [&_pre]:overflow-x-auto">
                  {streamText ? (
                    <>
                      <div dangerouslySetInnerHTML={{ __html: markdownToHtml(streamText) }} />
                      <span className="stream-caret ml-0.5 inline-block" />
                    </>
                  ) : (
                    <span className="stream-caret" />
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </CardContent>
          <div className="border-t border-border/60 p-3 flex gap-2">
            <Input
              placeholder="Ask Nexus anything…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              disabled={streaming}
              autoFocus
            />
            <Button onClick={send} disabled={streaming || !input.trim()} size="icon" className="h-10 w-10 shrink-0">
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
