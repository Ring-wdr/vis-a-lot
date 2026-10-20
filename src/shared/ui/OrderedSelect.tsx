"use client";

import { Check, ChevronDown, X } from "lucide-react";
import {
  createContext,
  type KeyboardEvent,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Autocomplete,
  Button,
  Dialog,
  DialogTrigger,
  Input,
  ListBox,
  ListBoxItem,
  ListLayout,
  Popover,
  type Selection,
  TextField,
  Virtualizer,
} from "react-aria-components";
import styles from "./OrderedSelect.module.css";
import { toggleValue } from "./ordered-select-drag";
import { useDragSelect } from "./use-drag-select";

export type Option<T extends string> = { value: T; label: string };

/** 가상 스크롤 행 높이와 위아래 여백. 드래그 판정(clientY → index)도 같은 값을 쓴다. */
const ROW_SIZE = 30;
const LIST_PADDING = 4;

/**
 * 고른 순서 번호(1부터). React Aria는 렌더한 option을 캐시하므로 순서가 바뀔 때 1만 개 collection을
 * 다시 만들지 않도록, 번호는 context로 내려서 화면에 있는 행만 다시 그린다.
 */
const OrderContext = createContext<ReadonlyMap<string, number>>(new Map());

function OptionContent({ value, label }: { value: string; label: string }) {
  const order = useContext(OrderContext).get(value);
  return (
    <>
      <span className={styles.check} aria-hidden="true">
        {order !== undefined && <Check size={12} strokeWidth={3} />}
      </span>
      <span className={styles.optionLabel}>{label}</span>
      {order !== undefined && (
        <span className={styles.order} aria-hidden="true">
          {order}
        </span>
      )}
    </>
  );
}

/**
 * 고른 순서를 보장하는 다중 선택 selectbox. 고른 값은 순서 번호 칩으로 쌓이고, 칩의 ×로 빼면 뒤 순서가 당겨진다.
 * 팝업 목록에서 클릭하면 토글(끝에 추가 / 빼기), mouse로 드래그하면 지나간 순서대로 고르거나 뺀다.
 *
 * React Aria의 선택 값은 순서 없는 Set이라, 순서는 value 배열로 직접 들고 React Aria에는 Set으로만 넘긴다.
 */
export function OrderedSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = "추가…",
  disabled = false,
}: {
  label: string;
  options: readonly Option<T>[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const labelId = useId();
  const fieldRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const [anchorBox, setAnchorBox] = useState({ top: 0, height: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const labelOf = useMemo(
    () => new Map(options.map((o) => [o.value, o.label])),
    [options],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((o) => o.label.toLowerCase().includes(q))
      : options;
  }, [options, query]);
  const keys = useMemo(() => visible.map((o) => o.value), [visible]);
  const selectedKeys = useMemo(() => new Set<string>(value), [value]);
  const orderOf = useMemo(
    () => new Map(value.map((v, i) => [v as string, i + 1])),
    [value],
  );

  // 상위 <fieldset disabled>(history 다시 보기) 안이면 브라우저가 트리거를 :disabled로 만든다
  const isBlocked = () =>
    disabled || Boolean(triggerRef.current?.matches(":disabled"));

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  /**
   * 바깥 클릭으로 닫기. 팝업을 modal로 두면 React Aria가 바깥을 inert로 막아 팝업이 열린 채로 칩 ×를
   * 누를 수 없으므로 non-modal로 두고, 필드(칩·트리거)와 팝업 밖을 누를 때만 직접 닫는다.
   */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      // 열린 채로 트리거를 누르면 닫는다. React Aria에 맡기면 포커스가 트리거로 옮겨가며 blur로 먼저
      // 닫힌 뒤 press로 다시 열려 버리므로, 트리거의 press 처리까지 내려가지 않게 여기서 끝낸다.
      if (triggerRef.current?.contains(target)) {
        e.stopPropagation();
        setOpen(false);
        setQuery("");
        return;
      }
      if (fieldRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const drag = useDragSelect({
    listRef,
    keys,
    value,
    onChange,
    rowSize: ROW_SIZE,
    padding: LIST_PADDING,
    isBlocked,
  });

  /** React Aria가 키보드(Enter)나 touch 탭으로 바꾼 Set을 순서 있는 배열로 옮긴다 */
  const onSelectionChange = (next: Selection) => {
    if (isBlocked() || next === "all") return;
    const kept = value.filter((v) => next.has(v));
    const added = [...next].filter((k) => !selectedKeys.has(k as string));
    onChange([...kept, ...(added as T[])]);
  };

  /**
   * Space 토글. React Aria Autocomplete는 Space를 검색어 입력으로 남기므로(목록에 넘기지 않음),
   * 키보드로 가리킨 option이 있을 때만 토글하고 그렇지 않으면 공백을 입력한다.
   * 가리킨 option은 aria-activedescendant가 아니라 [data-focused]로 찾는다: Autocomplete가
   * aria-activedescendant를 한 박자 늦게 갱신해서 빠르게 누르면 직전 option이 잡힌다.
   */
  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== " " || isBlocked()) return;
    if (!e.currentTarget.getAttribute("aria-activedescendant")) return;
    const focused = listRef.current?.querySelector<HTMLElement>(
      '[role="option"][data-focused]',
    );
    const key = focused?.dataset.key;
    if (!key || !labelOf.has(key as T)) return;
    e.preventDefault();
    onChange(toggleValue(value, key as T));
  };

  return (
    <div className={styles.root}>
      {/*
        팝업 기준점. 고를 때마다 칩이 늘어 필드가 커져도 팝업이 따라 내려가지 않도록(드래그 중 목록이
        포인터 아래에서 움직이면 엉뚱한 행이 잡힌다) 연 순간의 필드 자리에 고정한다.
      */}
      <div
        ref={anchorRef}
        className={styles.anchor}
        style={anchorBox}
        aria-hidden="true"
      />
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div
        ref={fieldRef}
        className={styles.field}
        data-disabled={disabled || undefined}
      >
        {value.length > 0 && (
          <ol className={styles.chips} aria-label={`${label} 순서`}>
            {value.map((v, i) => (
              <li key={v} className={styles.chip}>
                <span className={styles.chipOrder}>{i + 1}</span>
                <span className={styles.chipLabel}>{labelOf.get(v) ?? v}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={`${labelOf.get(v) ?? v} 빼기`}
                  disabled={disabled}
                  // 팝업이 열려 있으면 검색 입력의 포커스를 지켜서(blur로 닫히지 않게) 연 채로 뺄 수 있게 한다
                  onMouseDown={(e) => {
                    if (open) e.preventDefault();
                  }}
                  onClick={() => {
                    if (!isBlocked()) onChange(value.filter((x) => x !== v));
                  }}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ol>
        )}
        <DialogTrigger
          isOpen={open}
          onOpenChange={(next) => {
            if (next && isBlocked()) return;
            if (next && fieldRef.current) {
              const field = fieldRef.current;
              setAnchorBox({
                top: field.offsetTop,
                height: field.offsetHeight,
              });
            }
            setOpen(next);
            if (!next) setQuery("");
          }}
        >
          <Button
            ref={triggerRef}
            className={styles.trigger}
            isDisabled={disabled}
            aria-labelledby={labelId}
            aria-describedby={`${labelId}-summary`}
          >
            <span id={`${labelId}-summary`} className={styles.summary}>
              {value.length === 0 ? placeholder : `${value.length}개 선택`}
            </span>
            <ChevronDown size={14} aria-hidden="true" />
          </Button>
          <Popover
            ref={popoverRef}
            isNonModal
            triggerRef={anchorRef}
            placement="bottom start"
            offset={4}
            className={styles.popover}
          >
            <Dialog aria-label={label} className={styles.dialog}>
              <Autocomplete
                inputValue={query}
                onInputChange={setQuery}
                // 입력 중 첫 항목을 자동으로 가리키면 Space가 공백 대신 토글이 돼 버린다
                disableAutoFocusFirst
              >
                <TextField
                  aria-label={`${label} 검색`}
                  className={styles.search}
                  autoFocus
                >
                  <Input placeholder="검색…" onKeyDown={onSearchKeyDown} />
                </TextField>
                <OrderContext.Provider value={orderOf}>
                  <Virtualizer
                    layout={ListLayout}
                    layoutOptions={{ rowSize: ROW_SIZE, padding: LIST_PADDING }}
                  >
                    <ListBox
                      ref={listRef}
                      aria-label={label}
                      className={styles.list}
                      items={visible}
                      selectionMode="multiple"
                      selectedKeys={selectedKeys}
                      onSelectionChange={onSelectionChange}
                      // 기본값(clearSelection)이면 Esc가 팝업을 닫기 전에 선택을 모두 지운다
                      escapeKeyBehavior="none"
                      renderEmptyState={() => (
                        <p className={styles.empty}>일치하는 항목이 없습니다</p>
                      )}
                      {...drag}
                    >
                      {(o) => (
                        <ListBoxItem
                          id={o.value}
                          textValue={o.label}
                          className={styles.option}
                        >
                          <OptionContent value={o.value} label={o.label} />
                        </ListBoxItem>
                      )}
                    </ListBox>
                  </Virtualizer>
                </OrderContext.Provider>
              </Autocomplete>
            </Dialog>
          </Popover>
        </DialogTrigger>
      </div>
    </div>
  );
}
