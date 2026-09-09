import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  Icon,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { useEffect, useState } from "react";
import { RuntimeSetup } from "./setup-ui";
import { DEFAULT_OUTPUT_DIR, DEFAULT_OUTPUT_DISPLAY, getRuntimeReport, type RuntimeReport } from "./runtime";
import { DownloadTasks } from "./task-ui";
import { enqueueTask, type CookieSource, type DownloadJob, type DownloadMode } from "./task-runner";
import { listTaskStates, readTaskAppState, writeTaskAppState } from "./task-store";

export interface DownloadFormValues {
  urls: string;
  mode: string;
  outputDir: string;
  subtitles: boolean;
  cookies: string;
}

function extractUrls(value: string): string[] {
  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));
}

function expandPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_OUTPUT_DIR;
  if (trimmed === "~") return homedir();
  if (trimmed.startsWith("~/")) return join(homedir(), trimmed.slice(2));
  return resolve(trimmed);
}

function getUnseenCompletionText(): string | null {
  const appState = readTaskAppState();
  if (appState.unseenCompletionIds && appState.unseenCompletionIds.length > 0) {
    const unseenTasks = listTaskStates().filter(
      (task) => task.status === "success" && appState.unseenCompletionIds?.includes(task.id),
    );
    if (unseenTasks.length > 0) {
      const label = unseenTasks[0]?.outputPath ? basename(unseenTasks[0].outputPath) : unseenTasks[0]?.url;
      return unseenTasks.length === 1
        ? `✅ 已完成：${label ?? "1 个任务"} · 打开 Download Queue 查看`
        : `✅ 已完成：${label ?? "任务"} 等 ${unseenTasks.length} 个任务 · 打开 Download Queue 查看`;
    }
  }
  const lastViewedAt = appState.lastViewedCompletionAt
    ? new Date(appState.lastViewedCompletionAt).getTime()
    : appState.lastSeenCompletionAt
      ? new Date(appState.lastSeenCompletionAt).getTime()
      : appState.lastCompletedAt
        ? new Date(appState.lastCompletedAt).getTime() - 10 * 60 * 1000
        : 0;
  const completed = listTaskStates()
    .filter((task) => task.status === "success" && task.finishedAt && new Date(task.finishedAt).getTime() > lastViewedAt)
    .sort((left, right) => (right.finishedAt ?? "").localeCompare(left.finishedAt ?? ""));
  if (completed.length === 0) return null;
  const label = completed[0].outputPath ? basename(completed[0].outputPath) : completed[0].url;
  return completed.length === 1
    ? `✅ 已完成：${label} · 打开 Download Queue 查看`
    : `✅ 已完成：${label} 等 ${completed.length} 个任务 · 打开 Download Queue 查看`;
}

export function DownloadForm() {
  const navigation = useNavigation();
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);
  const [runtimeReport, setRuntimeReport] = useState<RuntimeReport>(() => getRuntimeReport(DEFAULT_OUTPUT_DIR));
  const { handleSubmit, itemProps, setValue } = useForm<DownloadFormValues>({
    initialValues: {
      urls: "",
      mode: "mp4",
      outputDir: DEFAULT_OUTPUT_DISPLAY,
      subtitles: false,
      cookies: "none",
    },
    validation: {
      urls: (value) => (extractUrls(value ?? "").length > 0 ? undefined : "Paste at least one valid link"),
      outputDir: FormValidation.Required,
    },
    onSubmit(values) {
      const urls = extractUrls(values.urls);
      if (urls.length === 0) return;
      const inputCount = values.urls.split(/\s+/).filter(Boolean).length;
      const outputDir = expandPath(values.outputDir);
      const report = getRuntimeReport(outputDir);
      setRuntimeReport(report);
      if (!report.ready) {
        void showToast({
          style: Toast.Style.Failure,
          title: "下载环境未准备好",
          message: "先打开 Download Setup 查看需要补充什么",
        });
        navigation.push(<RuntimeSetup outputDir={outputDir} />);
        return;
      }

      const job: DownloadJob = {
        mode: values.mode as DownloadMode,
        outputDir,
        subtitles: values.subtitles,
        cookies: values.cookies as CookieSource,
        ytDlpPath: report.ytDlp.path ?? undefined,
        ffmpegPath: report.ffmpeg.path ?? undefined,
      };
      urls.forEach((url) => enqueueTask(job, url));
      void showToast({
        style: Toast.Style.Success,
        title: `${urls.length} download${urls.length === 1 ? "" : "s"} added`,
        message:
          inputCount > urls.length
            ? `${inputCount - urls.length} 个内容无法识别，已跳过 · 在 Download Queue 查看状态`
            : "可以关闭 Raycast；在 Download Queue 查看进度",
      });

      navigation.push(<DownloadTasks />);
    },
  });

  useEffect(() => {
    setCompletionNotice(getUnseenCompletionText());
    setRuntimeReport(getRuntimeReport(DEFAULT_OUTPUT_DIR));
  }, []);

  const openCompletionTasks = () => {
    setCompletionNotice(null);
    navigation.push(<DownloadTasks />);
  };

  const pasteFromClipboard = async () => {
    const text = await Clipboard.readText();
    const urls = extractUrls(text ?? "");
    if (urls.length === 0) {
      void showToast({ style: Toast.Style.Failure, title: "剪贴板里没有可识别的链接" });
      return;
    }
    setValue("urls", urls.join("\n"));
    void showToast({ style: Toast.Style.Success, title: `已粘贴 ${urls.length} 个链接` });
  };

  return (
    <Form
      enableDrafts
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Media" onSubmit={handleSubmit} icon={Icon.Download} />
          <Action title="Paste Links from Clipboard" icon={Icon.Clipboard} onAction={() => void pasteFromClipboard()} />
          <Action.Push
            title="Download Setup"
            icon={Icon.Gear}
            target={<RuntimeSetup outputDir={expandPath(itemProps.outputDir.value ?? DEFAULT_OUTPUT_DISPLAY)} />}
          />
          {completionNotice && (
            <Action title="Show Completed Downloads" icon={Icon.Checkmark} onAction={openCompletionTasks} />
          )}
        </ActionPanel>
      }
    >
      {completionNotice && <Form.Description title="Download update" text={completionNotice} />}
      <Form.TextArea
        title="Media Link"
        placeholder="Paste one or more links, one per line"
        autoFocus
        storeValue
        {...itemProps.urls}
      />
      <Form.Dropdown title="Save as" storeValue {...itemProps.mode}>
        <Form.Dropdown.Item value="mp4" title="Video · best quality" />
        <Form.Dropdown.Item value="video" title="Video · keep original format" />
        <Form.Dropdown.Item value="audio" title="Audio · MP3" />
      </Form.Dropdown>
      <Form.TextField title="Save to folder" placeholder={DEFAULT_OUTPUT_DISPLAY} storeValue {...itemProps.outputDir} />
      <Form.Checkbox
        title="Include subtitles"
        label="Save Chinese or English subtitles when available"
        storeValue
        {...itemProps.subtitles}
      />
      <Form.Dropdown title="Browser login" storeValue {...itemProps.cookies}>
        <Form.Dropdown.Item value="none" title="Do not use browser login" />
        <Form.Dropdown.Item value="chrome" title="Use Chrome login" />
        <Form.Dropdown.Item value="safari" title="Use Safari login" />
        <Form.Dropdown.Item value="firefox" title="Use Firefox login" />
      </Form.Dropdown>
      <Form.Description
        title="When to use browser login"
        text="Only turn this on when a website asks you to sign in. Login data stays on this Mac."
      />
      <Form.Description
        title="Setup"
        text={
          runtimeReport.ready
            ? "Ready · this Mac can save media"
            : "Needs attention · open Download Setup before saving media"
        }
      />
    </Form>
  );
}
