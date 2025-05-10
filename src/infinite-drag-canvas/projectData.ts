import type { Project } from "./types";

export const projects: Project[] = [
  {
    id: "proj1",
    title: "Eco Innovate",
    categories: ["Sustainability", "Tech"],
    imageUrl: "https://picsum.photos/seed/proj1/320/180",
  },
  {
    id: "proj2",
    title: "Artistic Visions",
    categories: ["Art", "Design"],
    imageUrl: "https://picsum.photos/seed/proj2/320/180",
  },
  {
    id: "proj3",
    title: "Space Explorer",
    categories: ["Sci-Fi", "Game"],
    imageUrl: "https://picsum.photos/seed/proj3/320/180",
  },
  {
    id: "proj4",
    title: "Culinary Delights",
    categories: ["Food", "Lifestyle"],
    imageUrl: "https://picsum.photos/seed/proj4/320/180",
  },
  {
    id: "proj5",
    title: "Urban Renewal",
    categories: ["Architecture", "City"],
    imageUrl: "https://picsum.photos/seed/proj5/320/180",
  },
  {
    id: "proj6",
    title: "AI Frontiers",
    categories: ["AI", "Research"],
    imageUrl: "https://picsum.photos/seed/proj6/320/180",
  },
  {
    id: "proj7",
    title: "Deep Sea Odyssey",
    categories: ["Nature", "Exploration"],
    imageUrl: "https://picsum.photos/seed/proj7/320/180",
  },
  {
    id: "proj8",
    title: "Musical Journeys",
    categories: ["Music", "Events"],
    imageUrl: "https://picsum.photos/seed/proj8/320/180",
  },
  // Add more projects as needed to ensure enough unique content for your grid.
  // If your grid is 4 rows x 7 columns = 28 cards per tile segment,
  // having at least 28 projects here would be ideal to avoid immediate visual repetition.
];
