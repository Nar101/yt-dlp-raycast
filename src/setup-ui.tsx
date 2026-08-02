import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_OUTPUT_DIR,
  DEFAULT_OUTPUT_DISPLAY,
  getRuntimeReport,
  getTerminalAppPath,
  type BinaryStatus,
  type RuntimeReport,
} from "./runtime";

export function RuntimeSetup({ outputDir = DEFAULT_OUTPUT_DIR }: { outputDir?: string }) {
  const [report, setReport] = useState<RuntimeReport | null>(null);

  const refresh = useCallback(() => {
    setReport(getRuntimeReport(outputDir));
  }, [outputDir]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const statusIcon = (status: BinaryStatus) => (status.path && status.version ? Icon.Checkmark : Icon.XMarkCircle);
  const statusText = (status: BinaryStatus) => {
    if (status.path && status.version) return `Ready · ${status.version}`;
    return "Not found · follow the setup steps below";
  };
  const outputFolderLabel = outputDir === DEFAULT_OUTPUT_DIR ? DEFAULT_OUTPUT_DISPLAY : outputDir;

  if (!report) {
    return <List isLoading navigationTitle="Download Setup" />;
  }

  return (
    <List
      navigationTitle={report.ready ? "Download Setup · Ready" : "Download Setup · Action Needed"}
      searchBarPlaceholder="Search setup"
      actions={
        <ActionPanel>
          <Action title="Recheck Setup" icon={Icon.ArrowClockwise} onAction={refresh} />
          <Action.CopyToClipboard title="Copy Setup Command" content={report.installCommand} icon={Icon.Clipboard} />
          <Action.OpenInBrowser title="Open Setup Help" url="https://brew.sh" icon={Icon.Globe} />
          <Action.Open title="Open Terminal" target={getTerminalAppPath()} icon={Icon.Terminal} />
          <Action.Open title="Open Save Folder" target={report.outputDirectory.path} icon={Icon.Folder} />
        </ActionPanel>
      }
    >
      <List.Section title={report.ready ? "Ready to save" : "Action needed"}>
        <List.Item
          title="Download setup"
          subtitle={report.ready ? "This Mac is ready to save media" : "Finish setup, then check again"}
          icon={report.ready ? Icon.Checkmark : Icon.ExclamationMark}
          accessories={[{ text: report.ready ? "Ready" : "Not ready" }]}
        />
      </List.Section>
      <List.Section title="What this Mac needs">
        <List.Item title="Link support" subtitle={statusText(report.ytDlp)} icon={statusIcon(report.ytDlp)} />
        <List.Item title="Video support" subtitle={statusText(report.ffmpeg)} icon={statusIcon(report.ffmpeg)} />
        <List.Item
          title="Install helper"
          subtitle={statusText(report.homebrew)}
          icon={statusIcon(report.homebrew)}
          accessories={report.homebrew.path ? [] : [{ text: "Optional if tools are already on PATH" }]}
        />
      </List.Section>
      <List.Section title="Save folder">
        <List.Item
          title={outputFolderLabel}
          subtitle={
            report.outputDirectory.error
              ? report.outputDirectory.error
              : report.outputDirectory.freeBytes === null
                ? "Writable"
                : `${(report.outputDirectory.freeBytes / 1024 / 1024 / 1024).toFixed(1)} GB free`
          }
          icon={report.outputDirectory.writable && !report.outputDirectory.error ? Icon.Checkmark : Icon.XMarkCircle}
        />
      </List.Section>
      {!report.ready && (
        <List.Section title="How to fix">
          <List.Item
            title="Finish setup in Terminal"
            subtitle="Copy the setup command, run it in Terminal, then recheck."
            icon={Icon.Terminal}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard title="Copy Setup Command" content={report.installCommand} />
                <Action.OpenInBrowser title="Open Setup Help" url="https://brew.sh" icon={Icon.Globe} />
                <Action.Open title="Open Terminal" target={getTerminalAppPath()} icon={Icon.Terminal} />
                <Action title="Recheck Setup" icon={Icon.ArrowClockwise} onAction={refresh} />
              </ActionPanel>
            }
          />
        </List.Section>
      )}
    </List>
  );
}
