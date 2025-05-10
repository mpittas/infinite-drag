import type { Project } from "./types";

export const projects: Project[] = [
  {
    id: "proj1",
    title: "Eco Innovate",
    categories: ["Sustainability", "Tech"],
    imageUrl: "placeholder1.jpg",
  },
  {
    id: "proj2",
    title: "Artistic Visions",
    categories: ["Art", "Design"],
    imageUrl: "placeholder2.jpg",
  },
  {
    id: "proj3",
    title: "Space Explorer",
    categories: ["Sci-Fi", "Game"],
    imageUrl: "placeholder3.jpg",
  },
  {
    id: "proj4",
    title: "Culinary Delights",
    categories: ["Food", "Lifestyle"],
    imageUrl: "placeholder4.jpg",
  },
  {
    id: "proj5",
    title: "Urban Renewal",
    categories: ["Architecture", "City"],
    imageUrl: "placeholder5.jpg",
  },
  {
    id: "proj6",
    title: "AI Frontiers",
    categories: ["AI", "Research"],
    imageUrl: "placeholder6.jpg",
  },
  {
    id: "proj7",
    title: "Deep Sea Odyssey",
    categories: ["Nature", "Exploration"],
    imageUrl: "placeholder7.jpg",
  },
  {
    id: "proj8",
    title: "Musical Journeys",
    categories: ["Music", "Events"],
    imageUrl: "placeholder8.jpg",
  },
  // Add more projects as needed to ensure enough unique content for your grid.
  // If your grid is 4 rows x 7 columns = 28 cards per tile segment,
  // having at least 28 projects here would be ideal to avoid immediate visual repetition.
];
