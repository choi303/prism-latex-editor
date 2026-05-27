"use client";

import { create } from "zustand";

type WorkspaceState = {
  activeView: "chat" | "prompts" | "files";
  activeConversationId: string | null;
  setActiveView: (view: WorkspaceState["activeView"]) => void;
  setActiveConversationId: (conversationId: string | null) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeView: "chat",
  activeConversationId: null,
  setActiveView: (activeView) => set({ activeView }),
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
}));