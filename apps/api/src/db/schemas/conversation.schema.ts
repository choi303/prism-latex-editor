import { Schema, model, models } from "mongoose";

const conversationSchema = new Schema(
  {
    ownerRef: {
      type: String,
      default: null,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    modelSegment: {
      type: String,
      enum: ["fast", "balanced", "premium"],
      default: "balanced"
    },
    systemPrompt: {
      type: String,
      default: ""
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const ConversationModel =
  models.Conversation || model("Conversation", conversationSchema);