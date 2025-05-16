import React from "react";
import type { Project } from "@/types/types"; // Assuming Project type is here

interface ProjectListItemProps {
  project: Project;
}

const ProjectListItem: React.FC<ProjectListItemProps> = ({ project }) => {
  return (
    <li
      style={{
        border: "1px solid #ccc",
        margin: "10px",
        padding: "10px",
        listStyleType: "none",
        borderRadius: "5px",
        textAlign: "left",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{project.title}</h3>
      {project.imageUrl && (
        <img
          src={project.imageUrl}
          alt={project.title}
          style={{
            maxWidth: "100px",
            maxHeight: "100px",
            marginRight: "10px",
            float: "left",
          }}
        />
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
      <div style={{ clear: "both" }}></div>
    </li>
  );
};

export default ProjectListItem;
