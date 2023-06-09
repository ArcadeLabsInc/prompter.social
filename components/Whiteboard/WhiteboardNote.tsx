import clsx from 'clsx'
import {
    ChangeEventHandler, ComponentProps, FocusEventHandler, KeyboardEvent, memo,
    PointerEventHandler, useCallback, useRef, useState
} from 'react'
import { Select } from '@/primitives/Select'
import { OpenAIModels } from '@/types/openai'
import { CrossIcon, PlusIcon, SelectIcon } from '../../icons'
import { useStorage } from '../../liveblocks.config'
import { Avatar } from '../../primitives/Avatar'
import { Button } from '../../primitives/Button'
import styles from './WhiteboardNote.module.css'

interface Props
  extends Omit<
    ComponentProps<"div">,
    "id" | "onBlur" | "onChange" | "onFocus"
  > {
  dragged: boolean;
  id: string;
  onBlur: FocusEventHandler<HTMLTextAreaElement>;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  onDelete: () => void;
  onFocus: FocusEventHandler<HTMLTextAreaElement>;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  insertNote: (
    text?: string,
    x?: number,
    y?: number,
    stuff?: any
  ) => string | null;
  handleNoteUpdate: (
    id: string,
    note: { text?: string; from?: "user" | "assistant" | "system" }
  ) => void;
  notesMap: any;
  getNotesAbove: (
    note: any,
    notesMap: any
  ) => Array<{
    from: "user" | "assistant" | "system";
    id: string;
  }>;
}

export const WhiteboardNote = memo(
  ({
    id,
    insertNote,
    dragged,
    onPointerDown,
    onDelete,
    onChange,
    onFocus,
    onBlur,
    style,
    className,
    handleNoteUpdate,
    notesMap,
    getNotesAbove,
    ...props
  }: Props) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const note = useStorage((root) => root.notes.get(id));
    const [collapsed, setCollapsed] = useState(false);

    function toggleCollapsed() {
      setCollapsed((prevCollapsed) => !prevCollapsed);
    }

    const handleDoubleClick = useCallback(() => {
      textAreaRef.current?.focus();
    }, []);

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (!note) {
          return null;
        }

        if (event.key === "Escape") {
          textAreaRef.current?.blur();
        }

        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault(); // Prevent creating a new line in the textarea
          const text = textAreaRef.current?.value;

          const aboveNotes = getNotesAbove(note, notesMap);

          // Calculate the new note position (a bit below and to the right of the submitted note)
          const xOffset = 0;
          const yOffset = 20;
          const noteElement =
            textAreaRef.current?.parentElement?.parentElement?.parentElement;
          const noteHeight = noteElement?.clientHeight ?? 0;
          const currentX = note.x;
          const currentY = note.y;
          const newX = currentX + xOffset;
          const newY = currentY + noteHeight + yOffset;

          const newNoteId = insertNote("Sending...", newX, newY, "assistant");

          const submitChat = async () => {
            const previousMessages = aboveNotes.map((aboveNote) => ({
              role: aboveNote.from,
              content: aboveNote.content,
            }));
            const messageData = {
              model: OpenAIModels["gpt-4"],
              messages: [
                ...previousMessages,
                {
                  role: "user",
                  content: text,
                },
              ],
              key: "your_key",
              temperature: 0.7,
            };

            // console.log("messageData", messageData);

            const response = await fetch("/api/chat", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(messageData),
            });

            if (response.ok) {
              const data = response.body;
              if (!data) {
                console.log("No data...!");
                return;
              }
              const reader = data.getReader();
              const decoder = new TextDecoder();
              let done = false;
              let text = "";

              while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value);
                text += chunkValue;
                if (newNoteId) {
                  handleNoteUpdate(newNoteId, { text });
                }
              }
            } else {
              console.error("Error submitting chat:", response.statusText);
            }
          };

          submitChat();
        }
      },
      [note]
    );

    if (!note) {
      return null;
    }

    const { x, y, text, selectedBy } = note;

    return (
      <div
        className={clsx(className, styles.container)}
        data-note={id}
        onDoubleClick={handleDoubleClick}
        onPointerDown={onPointerDown}
        style={{
          transform: `translate(${x}px, ${y}px)`,
          transition: dragged ? "none" : undefined,
          zIndex: dragged ? 1 : 0,
          cursor: dragged ? "grabbing" : "grab",
          ...style,
        }}
        {...props}
      >
        <div className={styles.note}>
          <div className={styles.header}>
            <Select
              initialValue={note.from}
              items={[
                { value: "user", title: "User" },
                // { value: "system", title: "System" },
                { value: "assistant", title: "Assistant" },
              ]}
              onChange={(value: "user" | "system" | "assistant") => {
                // Handle the value change, e.g., update the state or call a function
                handleNoteUpdate(id, { from: value });
              }}
              value={note.from}
            />

            <div className={styles.iconButtons}>
              <Button
                className={styles.deleteButton}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapsed();
                }}
                icon={<SelectIcon />}
                variant={collapsed ? "subtle" : "primary"}
              />
              <Button
                className={styles.deleteButton}
                icon={<CrossIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                variant="subtle"
              />
            </div>
            <div className={styles.presence}>
              {selectedBy ? (
                <Avatar
                  color={selectedBy.color}
                  name={selectedBy.name}
                  outline
                  src={selectedBy.avatar}
                />
              ) : null}
            </div>
          </div>
          <div
            className={clsx(
              styles.content,
              collapsed ? styles.collapsed : null
            )}
          >
            <div className={styles.textAreaSize}>{text + " "}</div>
            <textarea
              className={styles.textArea}
              onBlur={onBlur}
              onChange={onChange}
              onFocus={onFocus}
              onKeyDown={handleKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="Write note…"
              ref={textAreaRef}
              value={text}
            />
          </div>
        </div>
      </div>
    );
  }
);
