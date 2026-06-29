import mongoose from "mongoose";
import dotenv from "dotenv";
import HomepageContent from "./settings/homepageModel.js";

dotenv.config({ path: "./.env" });

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
    console.log("MongoDB connected");

    let content = await HomepageContent.findOne();
    if (!content) {
      console.log("No homepage content found in DB.");
      process.exit(1);
    }

    let modified = false;
    const fixSlides = (slides) => {
      slides.forEach(slide => {
        if (slide.imageUrl && slide.imageUrl.endsWith('.png')) {
          slide.imageUrl = slide.imageUrl.replace('.png', '.webp');
          modified = true;
        }
        if (slide.mobileImage && slide.mobileImage.endsWith('.png')) {
          slide.mobileImage = slide.mobileImage.replace('.png', '.webp');
          modified = true;
        }
      });
    };

    if (content.draft && content.draft.heroSlides) fixSlides(content.draft.heroSlides);
    if (content.published && content.published.heroSlides) fixSlides(content.published.heroSlides);

    if (modified) {
      await content.save();
      console.log("Hero slides updated successfully in DB!");
    } else {
      console.log("No .png images found to update in DB.");
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

run();
