import { Schema, model, models } from "mongoose";

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ["system", "user", "assistant"],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["draft", "streaming", "completed", "error"],
      default: "completed"
    },
    tokenCount: {
      type: Number,
      default: 0
    },
    costUsd: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const MessageModel = models.Message || model("Message", messageSchema);