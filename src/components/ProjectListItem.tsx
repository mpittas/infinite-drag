import React from "react";
import type { Project } from "@/types/types";

interface ProjectListItemProps {
  project: Project;
}

const ProjectListItem: React.FC<ProjectListItemProps> = ({ project }) => {
  const listItemStyle: React.CSSProperties = {
    border: "1px solid #ccc",
    margin: "10px",
    padding: "10px",
    listStyleType: "none",
    borderRadius: "5px",
    textAlign: "left",
  };

  const titleStyle: React.CSSProperties = {
    marginTop: 0,
  };

  const imageStyle: React.CSSProperties = {
    maxWidth: "100px",
    maxHeight: "100px",
    marginRight: "10px",
    float: "left",
  };

  const clearStyle: React.CSSProperties = {
    clear: "both",
  };

  return (
    <li style={listItemStyle}>
      <h3 style={titleStyle}>{project.title}</h3>
      {project.imageUrl && (
        <img src={project.imageUrl} alt={project.title} style={imageStyle} />
      )}
      <p>
        <strong>ID:</strong> {project.id}
      </p>
      <p>
        <strong>Categories:</strong> {project.categories.join(", ")}
      </p>
      {project.description && (
        <p>
          <strong>Description:</strong> {project.description}
        </p>
      )}
      <div style={clearStyle}></div>
    </li>
  );
};

export default ProjectListItem;
