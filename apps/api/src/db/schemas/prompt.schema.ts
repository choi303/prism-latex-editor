import { Schema, model, models } from "mongoose";

const promptSchema = new Schema(
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
    category: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: String,
      required: true
    },
    tone: {
      type: String,
      default: "balanced"
    },
    isPinned: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const PromptModel = models.Prompt || model("Prompt", promptSchema);