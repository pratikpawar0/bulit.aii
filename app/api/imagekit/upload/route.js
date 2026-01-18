import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Use require for ImageKit to avoid ES module issues
const ImageKit = require("imagekit");

export async function POST(request) {
  try {
    console.log("ImageKit upload API called");
    
    // Verify authentication
    const { userId } = await auth();
    if (!userId) {
      console.log("Authentication failed - no userId");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("User authenticated:", userId);

    // Check environment variables
    const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
    
    console.log("Environment check:", {
      publicKey: publicKey ? "✓" : "✗",
      privateKey: privateKey ? "✓" : "✗", 
      urlEndpoint: urlEndpoint ? "✓" : "✗"
    });

    if (!publicKey || !privateKey || !urlEndpoint) {
      return NextResponse.json({ 
        error: "ImageKit configuration missing",
        details: "Check environment variables"
      }, { status: 500 });
    }

    // Initialize ImageKit
    const imagekit = new ImageKit({
      publicKey,
      privateKey,
      urlEndpoint,
    });
    console.log("ImageKit initialized");

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file");
    const fileName = formData.get("fileName");

    console.log("Form data received:", {
      hasFile: !!file,
      fileName,
      fileSize: file?.size,
      fileType: file?.type
    });

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log("File converted to buffer, size:", buffer.length);

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName =
      fileName?.replace(/[^a-zA-Z0-9.-]/g, "_") || "upload";
    const uniqueFileName = `${userId}/${timestamp}_${sanitizedFileName}`;
    console.log("Generated filename:", uniqueFileName);

    // Upload to ImageKit - Simple server-side upload
    console.log("Starting ImageKit upload...");
    const uploadResponse = await imagekit.upload({
      file: buffer,
      fileName: uniqueFileName,
      folder: "/blog_images",
    });
    console.log("ImageKit upload successful:", uploadResponse.fileId);

    // Return upload data
    return NextResponse.json({
      success: true,
      url: uploadResponse.url,
      fileId: uploadResponse.fileId,
      width: uploadResponse.width,
      height: uploadResponse.height,
      size: uploadResponse.size,
      name: uploadResponse.name,
    });
  } catch (error) {
    console.error("ImageKit upload error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to upload image",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
