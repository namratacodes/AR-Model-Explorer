import { useState } from "react";
import type { FormEvent } from "react";
import { api, errorMessage } from "../lib/api";
import { Alert, Button, Card, TextField } from "./ui";

export function CreateProjectForm({ onCreated }: { onCreated: () => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setCreated(null);
    try {
      const project = await api.createProject(name.trim(), description.trim());
      setCreated(`Project "${project.name}" created.`);
      setName("");
      setDescription("");
      await onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">New project</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error && <Alert>{error}</Alert>}
        {created && <Alert tone="success">{created}</Alert>}
        <TextField
          label="Name"
          required
          maxLength={120}
          placeholder="Breast Cancer Prediction"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Description (optional)"
          maxLength={1000}
          placeholder="Random Forest demo"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="submit" loading={creating} disabled={!name.trim()} className="w-full">
          Create project
        </Button>
      </form>
    </Card>
  );
}