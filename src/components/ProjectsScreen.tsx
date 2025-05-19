import React from "react";
import ProjectListItem from "../ProjectListItem"; // Adjust path as needed
import { projects } from "../data/projectData"; // Adjust path as needed

interface ProjectsScreenProps {
  navHeight: number;
}

const ProjectsScreen: React.FC<ProjectsScreenProps> = ({ navHeight }) => {
  return (
    <div
      style={{
        paddingTop: `${navHeight + 20}px`,
        maxHeight: `calc(100vh - ${navHeight + 20}px)`,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingBottom: "20px",
      }}
      className="projects-list-container"
    >
      <h2 style={{ color: "#f0f0f0", marginTop: "0" }}>Projects</h2>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          width: "80%",
          maxWidth: "600px",
        }}
      >
        {projects.map((project) => (
          <ProjectListItem key={project.id} project={project} />
        ))}
      </ul>
    </div>
  );
};

export default ProjectsScreen;
