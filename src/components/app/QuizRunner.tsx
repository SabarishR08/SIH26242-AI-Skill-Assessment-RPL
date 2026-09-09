"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, Code2, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuizData {
  quizId: string;
  skillName: string;
  claimedLevel?: number;
  mode?: string;
  questions: Array<{ prompt: string; options: string[]; skillFocus: string | null }>;
}

export interface QuizResult {
  score: number;
  passed: boolean;
  attemptsCount?: number;
  attemptsRemaining?: number;
  isTerminal?: boolean;
  verdict: string;
  breakdown: Array<{ questionId: string; correct: boolean; chosenIndex: number; correctIndex?: number; explanation?: string }>;
  milestoneCompleted?: boolean;
  replanHappened?: boolean;
}

export function QuizRunner({
  quiz,
  onSubmit,
  onFinished,
  title,
}: {
  quiz: QuizData;
  onSubmit: (quizId: string, answers: number[]) => Promise<QuizResult>;
  onFinished?: (result: QuizResult) => void;
  title?: string;
}) {
  const [answers, setAnswers] = useState<number[]>(Array(quiz.questions.length).fill(-1));
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = answers.filter((a) => a >= 0).length;
  const isLast = current === quiz.questions.length - 1;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await onSubmit(quiz.quizId, answers);
      setResult(r);
      onFinished?.(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const pct = Math.round(result.score * 100);
    return (
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            {result.passed ? (
              <CheckCircle2 className="h-8 w-8 text-primary" />
            ) : (
              <XCircle className="h-8 w-8 text-destructive" />
            )}
            <div>
              <CardTitle>{result.passed ? "Verified" : "Not verified yet"}</CardTitle>
              <p className="text-sm text-muted-foreground">{pct}% · pass mark 75%</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">{result.verdict}</p>
          <div className="space-y-3">
            {quiz.questions.map((q, i) => {
              const b = result.breakdown[i];
              if (!b) return null;
              return (
                <div key={i} className="rounded-lg border border-border/60 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    {b.correct ? (
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{q.prompt}</p>
                      {!b.correct && b.correctIndex != null && q.options[b.correctIndex] && (
                        <p className="text-muted-foreground mt-1">
                          Correct answer: <span className="text-foreground">{q.options[b.correctIndex]}</span>
                        </p>
                      )}
                      {b.explanation && (
                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{b.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            {!result.passed && !result.isTerminal && (result.attemptsRemaining ?? 1) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setAnswers(Array(quiz.questions.length).fill(-1));
                  setCurrent(0);
                }}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry Attempt ({result.attemptsRemaining} left)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-muted-foreground">No questions available for this quiz.</p>
        </CardContent>
      </Card>
    );
  }

  const q = quiz.questions[current];
  if (!q) return null;

  // Extract code snippet if present in markdown code block format (```lang ... ```)
  const codeMatch = q.prompt.match(/^([\s\S]*?)```([a-zA-Z0-9_-]*)\n([\s\S]*?)```([\s\S]*)$/);
  const parsedCode = codeMatch
    ? {
        preText: codeMatch[1].trim(),
        language: codeMatch[2].trim() || "code",
        code: codeMatch[3].trim(),
        postText: codeMatch[4].trim(),
      }
    : null;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title ?? `Calibration: ${quiz.skillName}`}</CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {current + 1} / {quiz.questions.length}
          </Badge>
        </div>
        {quiz.claimedLevel != null && (
          <p className="text-xs text-muted-foreground">
            Pitched at your claimed level ({quiz.claimedLevel}/5) — prove it.
          </p>
        )}
        <Progress value={(answeredCount / quiz.questions.length) * 100} className="h-1 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {q.skillFocus && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                q.skillFocus.toLowerCase().includes("debug") || parsedCode
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : ""
              )}
            >
              {(q.skillFocus.toLowerCase().includes("debug") || parsedCode) && (
                <Code2 className="mr-1 h-3 w-3 text-amber-400 inline" />
              )}
              {q.skillFocus}
            </Badge>
          )}
          {parsedCode && (
            <Badge variant="secondary" className="text-[10px] font-mono uppercase bg-zinc-800 text-zinc-300">
              <Terminal className="mr-1 h-2.5 w-2.5 inline" /> {parsedCode.language}
            </Badge>
          )}
        </div>

        {parsedCode ? (
          <div className="space-y-3">
            {parsedCode.preText && (
              <p className="font-medium text-sm text-foreground leading-relaxed">{parsedCode.preText}</p>
            )}
            <div className="rounded-lg border border-border/80 bg-zinc-950 p-3.5 font-mono text-xs overflow-x-auto shadow-inner">
              <div className="flex items-center justify-between border-b border-border/40 pb-1.5 mb-2 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5 font-semibold text-primary">
                  <Terminal className="h-3 w-3" /> {parsedCode.language.toUpperCase()}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Inspection challenge</span>
              </div>
              <pre className="text-emerald-400 leading-relaxed font-mono selection:bg-primary/30">
                <code>{parsedCode.code}</code>
              </pre>
            </div>
            {parsedCode.postText && (
              <p className="font-semibold text-sm leading-relaxed text-foreground">{parsedCode.postText}</p>
            )}
          </div>
        ) : (
          <p className="font-medium leading-relaxed whitespace-pre-wrap">{q.prompt}</p>
        )}

        <RadioGroup
          value={answers[current] >= 0 ? String(answers[current]) : undefined}
          onValueChange={(v) => {
            const next = [...answers];
            next[current] = parseInt(v, 10);
            setAnswers(next);
          }}
          className="gap-2"
        >
          {q.options.map((opt, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start space-x-3 rounded-lg border p-3 transition-colors cursor-pointer",
                answers[current] === i ? "border-primary/60 bg-primary/8" : "border-border/60 hover:bg-secondary/60",
              )}
              onClick={() => {
                const next = [...answers];
                next[current] = i;
                setAnswers(next);
              }}
            >
              <RadioGroupItem value={String(i)} id={`q${current}-o${i}`} className="mt-0.5" />
              <Label htmlFor={`q${current}-o${i}`} className="text-sm font-normal leading-relaxed cursor-pointer">
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" size="sm" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
            Back
          </Button>
          {answeredCount === quiz.questions.length && isLast ? (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Grading…" : "Submit answers"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled={answers[current] < 0 || (isLast && answeredCount < quiz.questions.length)}
              onClick={() => setCurrent((c) => Math.min(c + 1, quiz.questions.length - 1))}
            >
              Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
