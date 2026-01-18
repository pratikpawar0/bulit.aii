"use client";

import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useConvexMutation } from "@/hooks/use-convex-query";
import PostEditorHeader from "./post-editor-header";
import PostEditorContent from "./post-editor-content";
import PostEditorSettings from "./post-editor-settings";
import ImageUploadModal from "./image-upload-modal";

const postSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  content: z.string().min(1, "Content is required").refine(
    (content) => {
      // Remove HTML tags and check if there's actual content
      const textContent = content.replace(/<[^>]*>/g, '').trim();
      return textContent.length > 0;
    },
    { message: "Content cannot be empty" }
  ),
  category: z.string().optional(),
  tags: z.array(z.string()).max(10, "Maximum 10 tags allowed").default([]),
  featuredImage: z.string().optional(),
  scheduledFor: z.string().optional(),
});

export default function PostEditor({
  initialData = null,
  mode = "create", // "create" or "edit"
}) {
  const router = useRouter();
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageModalType, setImageModalType] = useState("featured");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quillRef, setQuillRef] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Mutations with built-in loading states
  const { mutate: createPost, isLoading: isCreateLoading } = useConvexMutation(
    api.posts.create
  );
  const { mutate: updatePost, isLoading: isUpdating } = useConvexMutation(
    api.posts.update
  );

  // Form setup
  const form = useForm({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: initialData?.title || "",
      content: initialData?.content || "",
      category: initialData?.category || "",
      tags: initialData?.tags || [],
      featuredImage: initialData?.featuredImage || "",
      scheduledFor: initialData?.scheduledFor
        ? new Date(initialData.scheduledFor).toISOString().slice(0, 16)
        : "",
    },
  });

  const { handleSubmit, watch, setValue } = form;
  const watchedValues = watch();

  // Auto-save for drafts
  useEffect(() => {
    if (!watchedValues.title && !watchedValues.content) return;

    const autoSave = setInterval(async () => {
      if (mountedRef.current && (watchedValues.title || watchedValues.content)) {
        if (mode === "create") {
          try {
            await handleSave(true); // Silent save
          } catch (error) {
            // Silent save failed, but don't show error to user
            console.error("Auto-save failed:", error);
          }
        }
      }
    }, 30000);

    return () => clearInterval(autoSave);
  }, [watchedValues.title, watchedValues.content, mode]);

  // Handle image selection
  const handleImageSelect = (imageData) => {
    if (imageModalType === "featured") {
      setValue("featuredImage", imageData.url);
      toast.success("Featured image added!");
    } else if (imageModalType === "content" && quillRef) {
      const quill = quillRef.getEditor();
      const range = quill.getSelection();
      const index = range ? range.index : quill.getLength();

      quill.insertEmbed(index, "image", imageData.url);
      quill.setSelection(index + 1);
      toast.success("Image inserted!");
    }
    setIsImageModalOpen(false);
  };

  // Submit handler
  const onSubmit = async (data, action, silent = false) => {
    try {
      console.log("PostEditor onSubmit called with:", { data, action, silent });
      
      const postData = {
        title: data.title,
        content: data.content,
        category: data.category || undefined,
        tags: data.tags,
        featuredImage: data.featuredImage || undefined,
        status: action === "publish" ? "published" : "draft",
        scheduledFor: data.scheduledFor
          ? new Date(data.scheduledFor).getTime()
          : undefined,
      };

      console.log("Prepared postData:", postData);

      let resultId;

      if (mode === "edit" && initialData?._id) {
        console.log("Using update for edit mode");
        // Always use update for edit mode
        resultId = await updatePost({
          id: initialData._id,
          ...postData,
        });
      } else if (initialData?._id && action === "draft") {
        console.log("Updating existing draft");
        // If we have existing draft data, update it
        resultId = await updatePost({
          id: initialData._id,
          ...postData,
        });
      } else {
        console.log("Creating new post");
        // Create new post (will auto-update existing draft if needed)
        resultId = await createPost(postData);
      }

      console.log("Post operation successful, resultId:", resultId);

      if (!silent) {
        const message =
          action === "publish" ? "Post published!" : "Draft saved!";
        toast.success(message);
        if (action === "publish") router.push("/dashboard/posts");
      }

      return resultId;
    } catch (error) {
      console.error("PostEditor onSubmit error:", error);
      if (!silent) toast.error(error.message || "Failed to save post");
      throw error;
    }
  };

  const handleSave = (silent = false) => {
    console.log("handleSave called, current form values:", watchedValues);
    handleSubmit((data) => {
      console.log("Form validation passed, data:", data);
      return onSubmit(data, "draft", silent);
    }, (errors) => {
      console.log("Form validation failed, errors:", errors);
      if (!silent) {
        toast.error("Please check the form for errors");
      }
    })();
  };

  const handlePublish = () => {
    console.log("handlePublish called, current form values:", watchedValues);
    handleSubmit((data) => {
      console.log("Form validation passed for publish, data:", data);
      return onSubmit(data, "publish");
    }, (errors) => {
      console.log("Form validation failed for publish, errors:", errors);
      toast.error("Please check the form for errors");
    })();
  };

  const handleSchedule = () => {
    if (!watchedValues.scheduledFor) {
      toast.error("Please select a date and time to schedule");
      return;
    }
    handleSubmit((data) => onSubmit(data, "schedule"))();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <PostEditorHeader
        mode={mode}
        initialData={initialData}
        isPublishing={isCreateLoading || isUpdating}
        onSave={handleSave}
        onPublish={handlePublish}
        onSchedule={handleSchedule}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        onBack={() => router.push("/dashboard")}
      />

      <PostEditorContent
        form={form}
        setQuillRef={setQuillRef}
        onImageUpload={(type) => {
          setImageModalType(type);
          setIsImageModalOpen(true);
        }}
      />

      <PostEditorSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        form={form}
        mode={mode}
      />

      <ImageUploadModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onImageSelect={handleImageSelect}
        title={
          imageModalType === "featured"
            ? "Upload Featured Image"
            : "Insert Image"
        }
      />
    </div>
  );
}
