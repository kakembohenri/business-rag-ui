"use client";

import { streamChat } from "@/api/chat";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  CircleStop,
  RotateCcw,
  Send,
  User,
} from "lucide-react";
import { SubmitEvent, useRef, useState } from "react";

type Message = { role: "assistant" | "user"; content: string };

const formatAssistantText = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      "text" in parsed &&
      typeof parsed.text === "string"
    ) {
      return parsed.text;
    }
  } catch {
    // The API may return plain text instead of a JSON envelope.
  }
  return value;
};

const starterMessages: Message[] = [
  {
    role: "assistant",
    content:
      "Hi, I'm the Parts Unlimited assistant. Ask me about our products, capabilities, or support.",
  },
];

const faqs = [
  "How do I find the right part for my vehicle?",
  "Do you offer same-day delivery?",
  "What is your returns policy?",
  "Where can I find my nearest store?",
];

const ChatPanel = () => {
  const [collapsed, setCollapsed] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const getThreadId = () => {
    const storedThreadId = sessionStorage.getItem("thread_id");
    if (storedThreadId) return storedThreadId;
    const threadId = crypto.randomUUID();
    sessionStorage.setItem("thread_id", threadId);
    return threadId;
  };

  const clearChat = () => {
    if (isStreaming) return;
    setMessages(starterMessages);
    setInput("");
    setStatus("");
    sessionStorage.removeItem("thread_id");
  };

  const scrollToEnd = () => {
    requestAnimationFrame(() =>
      endRef.current?.scrollIntoView({ behavior: "smooth" }),
    );
  };

  const askQuestion = async (question: string) => {
    if (isStreaming) return;
    setMessages((current) => [...current, { role: "user", content: question }]);
    setInput("");
    setIsStreaming(true);
    setStatus("");
    const controller = new AbortController();
    controllerRef.current = controller;
    scrollToEnd();

    await streamChat(question, {
      threadId: getThreadId(),
      signal: controller.signal,
      onStatus: setStatus,
      onAnswer: (text) =>
        setMessages((current) => [
          ...current,
          { role: "assistant", content: formatAssistantText(text) },
        ]),
      onError: (message) =>
        setMessages((current) => [
          ...current,
          { role: "assistant", content: message },
        ]),
      onDone: () => setStatus(""),
    });

    controllerRef.current = null;
    setIsStreaming(false);
    setStatus("");
    scrollToEnd();
  };

  const stopStreaming = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsStreaming(false);
    setStatus("Answer stopped.");
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    void askQuestion(trimmed);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Expand chat"
        className="ml-auto flex items-center gap-3 rounded-full bg-[#17232b] px-4 py-3 text-left text-white shadow-2xl ring-1 ring-white/15 transition hover:bg-[#e96d32]"
      >
        <span className="grid size-9 place-items-center rounded-full bg-[#e96d32] text-white">
          <Bot />
        </span>
        <span className="pr-1 text-sm font-bold">Ask our assistant</span>
        <ChevronUp />
      </button>
    );
  }

  return (
    <div className="ml-auto overflow-hidden rounded-3xl bg-[#f6f4ef] text-[#17232b] shadow-2xl ring-1 ring-black/10">
      <div className="flex items-center justify-between border-b border-[#17232b]/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[#e96d32] text-white">
            <Bot />
          </span>
          <div>
            <p className="font-bold">Parts Unlimited Assistant</p>
            <p className="text-xs text-[#17232b]/50">
              Document-grounded answers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearChat}
            disabled={isStreaming}
            aria-label="Clear chat"
            className="grid size-9 place-items-center rounded-full text-[#17232b]/60 transition hover:bg-[#17232b]/10 hover:text-[#17232b] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse chat"
            className="grid size-9 place-items-center rounded-full text-[#17232b]/60 transition hover:bg-[#17232b]/10 hover:text-[#17232b]"
          >
            <ChevronDown />
          </button>
        </div>
      </div>
      <div className="flex max-h-107.5 min-h-55 flex-col gap-4 overflow-y-auto p-5">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#17232b] text-white">
              {message.role === "user" ? <User /> : <Bot />}
            </span>
            <p
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[#e96d32] text-white" : "bg-white"}`}
            >
              {message.content}
            </p>
          </div>
        ))}
        {status && (
          <p
            className="ml-11 text-xs font-semibold text-[#17232b]/50"
            role="status"
          >
            {status}
          </p>
        )}
        {messages.length === 1 && (
          <div className="ml-11">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#17232b]/45">
              Frequently asked
            </p>
            <div className="flex flex-col items-start gap-2">
              {faqs.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => void askQuestion(question)}
                  className="rounded-full border border-[#e96d32]/35 bg-white px-3 py-2 text-left text-xs font-semibold text-[#17232b] transition hover:border-[#e96d32] hover:bg-[#fff2eb] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="border-t border-[#17232b]/10 p-4">
        <div className="flex items-center gap-2 rounded-2xl bg-white p-2 ring-1 ring-[#17232b]/10">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={isStreaming}
            placeholder="Ask a question..."
            aria-label="Ask a question"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-[#17232b]/40 disabled:opacity-50"
          />
          {isStreaming && (
            <button
              type="button"
              onClick={stopStreaming}
              aria-label="Stop response"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e96d32] text-white transition hover:bg-[#c95720]"
            >
              <CircleStop />
            </button>
          )}
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            aria-label="Send message"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#17232b] text-white transition hover:bg-[#e96d32] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[#17232b]/40">
          {isStreaming ? "Generating answer..." : "Press Enter to send"}
        </p>
      </form>
    </div>
  );
};
export default ChatPanel;
