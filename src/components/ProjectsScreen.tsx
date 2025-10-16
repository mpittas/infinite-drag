import React from "react";
import ProjectListItem from "./ProjectListItem";
import { projects } from "../data/projectData";

interface ProjectsScreenProps {
  navHeight: number;
}

const ProjectsScreen: React.FC<ProjectsScreenProps> = ({ navHeight }) => {
  const containerStyle: React.CSSProperties = {
    paddingTop: `${navHeight + 20}px`,
    maxHeight: `calc(100vh - ${navHeight + 20}px)`,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingBottom: "20px",
  };

  const titleStyle: React.CSSProperties = {
    color: "#f0f0f0",
    marginTop: "0",
  };

  const listStyle: React.CSSProperties = {
    listStyle: "none",
    padding: 0,
    width: "80%",
    maxWidth: "600px",
  };

  return (
    <div style={containerStyle} className="projects-list-container">
      <h2 style={titleStyle}>Projects</h2>
      <ul style={listStyle}>
        {projects.map((project) => (
          <ProjectListItem key={project.id} project={project} />
        ))}
      </ul>
    </div>
  );
};

export default ProjectsScreen;
