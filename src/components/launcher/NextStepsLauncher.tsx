"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  HiArrowLeft,
  HiArrowRight,
  HiArrowsPointingIn,
  HiArrowsPointingOut,
  HiMagnifyingGlass,
  HiChevronDown,
  HiRocketLaunch,
  HiXMark,
} from "react-icons/hi2";
import { RockConnectionOpportunitySignup } from "@/components/forms/RockConnectionOpportunitySignup";
import { RockForm } from "@/components/forms/RockForm";
import { SafeRockHtml } from "@/components/forms/SafeRockHtml";
import { FeedbackStrip } from "@/components/layout/FeedbackStrip";
import {
  MemberAccountControl,
  type MemberDisplayProfile,
} from "@/components/layout/MemberAccountControl";
import { useGivingExperience } from "@/components/giving/GivingExperienceProvider";
import {
  CONNECT_CARD_WORKFLOW_GUID,
  LAUNCHER_CAMPUS_STORAGE_KEY,
  PLAN_A_VISIT_WORKFLOW_GUID,
} from "@/lib/launcher/constants";
import type { LauncherCampus, LauncherItem } from "@/lib/launcher/types";
import type { PublicSiteFeedbackSettings } from "@/lib/site-feedback/settings";
import {
  chooseInitialCampus,
  createLauncherState,
  launcherItemMatches,
  launcherReducer,
  type LauncherView,
} from "./launcher-state";

export interface NextStepsLauncherProps {
  campuses: LauncherCampus[];
  items: LauncherItem[] | null;
  initialPathname?: string;
  memberCampusSlug?: string | null;
  feedback?: PublicSiteFeedbackSettings | null;
  signedInEmail?: string;
  memberProfile?: MemberDisplayProfile | null;
  adminHref?: string;
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const PLAN_A_VISIT_IMAGE_URL = "/images/homepage/carousel-146c7f7e.jpg";
const MOBILE_LAUNCHER_QUERY = "(max-width: 639px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const LAUNCHER_CLOSE_FALLBACK_MS = 300;

function viewTitle(view: LauncherView): string {
  switch (view.type) {
    case "home":
      return "Your next step";
    case "catalogue":
      return "More next steps";
    case "giving":
      return "Giving";
    case "feedback":
    case "workflow":
    case "connection":
    case "content":
      return view.title;
  }
}

function LauncherActionButton({
  title,
  onClick,
  animationDelay,
  featured = false,
}: {
  title: string;
  onClick: () => void;
  animationDelay: number;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      className={`group flex w-full animate-fade-in items-center justify-between gap-4 border border-warm-grey/70 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-rich-red/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red motion-reduce:animate-none ${
        featured ? "rounded-[1.35rem] px-6 py-6" : "rounded-2xl px-5 py-4"
      }`}
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={onClick}
    >
      <span
        className={`block font-semibold text-brand-black ${
          featured ? "text-xl sm:text-2xl" : "text-lg"
        }`}
      >
        {title}
      </span>
      <HiArrowRight
        className={`shrink-0 text-rich-red transition group-hover:translate-x-1 ${
          featured ? "h-6 w-6" : "h-5 w-5"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}

function LauncherBanner({
  imageUrl,
  constrainToContent = false,
  bleed = false,
}: {
  imageUrl?: string;
  constrainToContent?: boolean;
  bleed?: boolean;
}) {
  if (!imageUrl) return null;

  return (
    <div
      className={`mb-6 ${
        constrainToContent
          ? "mx-auto w-full max-w-2xl px-4 sm:px-6"
          : bleed
            ? "-mx-4 w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)]"
            : "w-full"
      }`}
    >
      <div className="aspect-video w-full overflow-hidden bg-warm-grey/30">
        <Image
          src={imageUrl}
          alt=""
          width={1200}
          height={675}
          loading="eager"
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

export function NextStepsLauncher({
  campuses,
  items,
  initialPathname,
  memberCampusSlug,
  feedback,
  signedInEmail,
  memberProfile,
  adminHref,
}: NextStepsLauncherProps) {
  const currentPathname = usePathname();
  const pathname = initialPathname ?? currentPathname ?? "/";
  const [state, dispatch] = useReducer(launcherReducer, null, () =>
    createLauncherState(),
  );
  const [campusReady, setCampusReady] = useState(false);
  const [campusMenuOpen, setCampusMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isCloseMotionActive, setIsCloseMotionActive] = useState(false);
  const giving = useGivingExperience();
  const launcherRootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousPathnameRef = useRef(pathname);
  const restoreTriggerFocusRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_LAUNCHER_QUERY);
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (isMobile && state.presentation === "compact") {
      dispatch({ type: "open", presentation: "fullscreen" });
    }
  }, [isMobile, state.presentation]);

  useEffect(() => {
    const routeOrStoredCampus = chooseInitialCampus({
      pathname,
      memberCampus: memberCampusSlug,
      storedCampus: window.localStorage.getItem(LAUNCHER_CAMPUS_STORAGE_KEY),
      validCampusSlugs: campuses.map((campus) => campus.slug),
    });
    dispatch({ type: "setCampus", campusSlug: routeOrStoredCampus });
    setCampusReady(true);
  }, [campuses, memberCampusSlug, pathname]);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    setCampusMenuOpen(false);
    dispatch({ type: "close" });
  }, [pathname]);

  useEffect(() => {
    if (!giving.consumeGivingRequest(giving.givingRequestId)) return;
    dispatch({
      type: "openGiving",
      presentation: isMobile ? "fullscreen" : "compact",
    });
  }, [giving.consumeGivingRequest, giving.givingRequestId, isMobile]);

  useEffect(() => {
    const active = state.presentation !== "collapsed" && !isClosing && state.view.type === "giving";
    giving.setGivingViewActive(active);
    return () => giving.setGivingViewActive(false);
  }, [giving.setGivingViewActive, isClosing, state.presentation, state.view.type]);

  const completeClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setIsClosing(false);
    setIsCloseMotionActive(false);
    setCampusMenuOpen(false);
    dispatch({ type: "close" });
  }, []);

  const close = useCallback(() => {
    if (isClosing) return;
    if (state.view.type === "giving" && giving.handleGivingClose()) return;
    restoreTriggerFocusRef.current = true;
    setCampusMenuOpen(false);
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      completeClose();
      return;
    }
    setIsClosing(true);
    closeTimerRef.current = setTimeout(
      completeClose,
      LAUNCHER_CLOSE_FALLBACK_MS,
    );
  }, [completeClose, giving.handleGivingClose, isClosing, state.view.type]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!isClosing) return;
    const animationFrame = window.requestAnimationFrame(() => {
      setIsCloseMotionActive(true);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isClosing]);

  useEffect(() => {
    if (state.presentation !== "collapsed" || !restoreTriggerFocusRef.current)
      return;
    restoreTriggerFocusRef.current = false;
    triggerRef.current?.focus();
  }, [state.presentation]);

  useEffect(() => {
    if (state.presentation === "collapsed") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (campusMenuOpen) {
          setCampusMenuOpen(false);
          return;
        }
        close();
        return;
      }
      if (state.presentation !== "fullscreen" || event.key !== "Tab") return;

      const panelFocusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ||
          [],
      ).filter((element) => !element.hasAttribute("disabled"));
      const focusable = triggerRef.current
        ? [...panelFocusable, triggerRef.current]
        : panelFocusable;
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [campusMenuOpen, close, state.presentation]);

  useEffect(() => {
    if (state.presentation !== "fullscreen") return;
    const root = launcherRootRef.current;
    const parent = root?.parentElement;
    if (!root || !parent) return;
    const changed: Array<{ element: HTMLElement; ariaHidden: string | null }> =
      [];
    for (const sibling of Array.from(parent.children)) {
      if (sibling === root || !(sibling instanceof HTMLElement)) continue;
      changed.push({
        element: sibling,
        ariaHidden: sibling.getAttribute("aria-hidden"),
      });
      sibling.inert = true;
      sibling.setAttribute("aria-hidden", "true");
    }
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      for (const { element, ariaHidden } of changed) {
        element.inert = false;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
    };
  }, [state.presentation]);

  useEffect(() => {
    if (state.presentation === "collapsed") return;
    window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    });
  }, [state.presentation === "collapsed"]);

  useEffect(() => {
    if (state.view.type === "catalogue" && scrollRef.current) {
      scrollRef.current.scrollTop = state.catalogueScrollTop;
    }
  }, [state.view, state.catalogueScrollTop]);

  const selectedCampusItems = useMemo(() => {
    if (!items || !state.campusSlug) return [];
    return items.filter(
      (item) =>
        item.campusSlugs.length === 0 ||
        item.campusSlugs.includes(state.campusSlug!),
    );
  }, [items, state.campusSlug]);

  const campusItems = useMemo(
    () =>
      selectedCampusItems.filter((item) =>
        launcherItemMatches(item, state.query),
      ),
    [selectedCampusItems, state.query],
  );

  const connectCardImageUrl = useMemo(() => {
    for (const item of items ?? []) {
      if (
        item.action.type === "workflow" &&
        item.action.workflowTypeGuid === CONNECT_CARD_WORKFLOW_GUID
      ) {
        return item.action.imageUrl;
      }
    }
    return undefined;
  }, [items]);
  const formViewHasBanner =
    (state.view.type === "workflow" || state.view.type === "connection") &&
    Boolean(state.view.imageUrl);

  const pushView = (view: LauncherView) => dispatch({ type: "push", view });

  const selectItem = (item: LauncherItem) => {
    dispatch({
      type: "setCatalogueScroll",
      scrollTop: scrollRef.current?.scrollTop || 0,
    });
    switch (item.action.type) {
      case "workflow":
        pushView({
          type: "workflow",
          title: item.title,
          workflowTypeGuid: item.action.workflowTypeGuid,
          imageUrl: item.action.imageUrl,
        });
        break;
      case "connection":
        pushView({
          type: "connection",
          title: item.title,
          blockGuid: item.action.blockGuid,
          imageUrl: item.action.imageUrl,
        });
        break;
      case "content":
        pushView({
          type: "content",
          title: item.title,
          html: item.action.html,
          imageUrl: item.action.imageUrl,
        });
        break;
      case "directLink":
      case "event":
        break;
    }
  };

  const selectCampus = (campusSlug: string) => {
    const selected = campuses.some((campus) => campus.slug === campusSlug)
      ? campusSlug
      : null;
    dispatch({ type: "setCampus", campusSlug: selected });
    if (selected)
      window.localStorage.setItem(LAUNCHER_CAMPUS_STORAGE_KEY, selected);
    else window.localStorage.removeItem(LAUNCHER_CAMPUS_STORAGE_KEY);
  };

  const renderCatalogue = () => (
    <div className="space-y-5">
      <div
        className="relative animate-fade-in text-sm font-semibold text-brand-black motion-reduce:animate-none"
        style={{ animationDelay: "140ms" }}
      >
        <span>Campus</span>
        <button
          type="button"
          className="mt-2 flex w-full items-center justify-between rounded-2xl border border-warm-grey/70 bg-white px-5 py-4 text-left text-base font-semibold text-brand-black shadow-sm transition hover:border-rich-red/35 hover:shadow-md focus-visible:ring-2 focus-visible:ring-rich-red"
          aria-haspopup="listbox"
          aria-expanded={campusMenuOpen}
          onClick={() => setCampusMenuOpen((open) => !open)}
        >
          {campuses.find((campus) => campus.slug === state.campusSlug)?.name ??
            "Choose a campus…"}
          <HiChevronDown
            className={`h-5 w-5 text-rich-red transition ${campusMenuOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {campusMenuOpen && (
          <div
            role="listbox"
            aria-label="Campus"
            className="mt-2 overflow-hidden rounded-2xl border border-warm-grey/70 bg-white p-2 shadow-lg"
          >
            {campuses.map((campus) => (
              <button
                key={campus.slug}
                type="button"
                role="option"
                aria-selected={campus.slug === state.campusSlug}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base transition hover:bg-warm-white ${
                  campus.slug === state.campusSlug
                    ? "font-semibold text-rich-red"
                    : "font-medium text-brand-black"
                }`}
                onClick={() => {
                  selectCampus(campus.slug);
                  setCampusMenuOpen(false);
                }}
              >
                {campus.name}
                {campus.slug === state.campusSlug && (
                  <span className="h-2 w-2 rounded-full bg-rich-red" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <label
        className="relative block animate-fade-in motion-reduce:animate-none"
        style={{ animationDelay: "195ms" }}
      >
        <span className="sr-only">Search next steps</span>
        <HiMagnifyingGlass
          className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-mid-grey"
          aria-hidden="true"
        />
        <input
          type="search"
          className="w-full rounded-full border border-warm-grey bg-white py-3 pr-4 pl-12 text-base text-brand-black placeholder:text-mid-grey focus:border-rich-red focus:outline-none focus:ring-2 focus:ring-rich-red/20"
          placeholder="Search next steps"
          value={state.query}
          onChange={(event) =>
            dispatch({ type: "setQuery", query: event.target.value })
          }
          disabled={!state.campusSlug}
        />
      </label>

      {!campusReady ? (
        <p className="rounded-xl bg-white p-5 text-sm text-mid-grey">
          Loading campuses…
        </p>
      ) : items === null ? (
        <p
          role="status"
          className="rounded-xl bg-white p-5 text-sm text-dark-grey"
        >
          Next steps are temporarily unavailable. Please try again soon.
        </p>
      ) : !state.campusSlug ? (
        <p className="rounded-xl bg-white p-5 text-sm text-dark-grey">
          Choose your campus to see the next steps available to you.
        </p>
      ) : selectedCampusItems.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-sm text-dark-grey">
          There are no next steps available for this campus right now.
        </p>
      ) : campusItems.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-sm text-dark-grey">
          No next steps match your search.
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Next steps">
          {campusItems.map((item, index) => (
            <li
              key={item.id}
              className="animate-fade-in motion-reduce:animate-none"
              style={{ animationDelay: `${250 + Math.min(index, 8) * 45}ms` }}
            >
              {item.action.type === "directLink" &&
              item.action.href.startsWith("/") ? (
                <Link
                  href={item.action.href}
                  className="group flex w-full items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red"
                >
                  <ItemLabel item={item} />
                  <HiArrowRight
                    className="h-5 w-5 shrink-0 text-rich-red"
                    aria-hidden="true"
                  />
                </Link>
              ) : item.action.type === "directLink" ? (
                <a
                  href={item.action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex w-full items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red"
                >
                  <ItemLabel item={item} />
                  <HiArrowRight
                    className="h-5 w-5 shrink-0 text-rich-red"
                    aria-hidden="true"
                  />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : item.action.type === "event" ? (
                <a
                  href={item.action.href}
                  className="group flex w-full items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red"
                >
                  <ItemLabel item={item} />
                  <HiArrowRight
                    className="h-5 w-5 shrink-0 text-rich-red"
                    aria-hidden="true"
                  />
                </a>
              ) : (
                <button
                  type="button"
                  className="group flex w-full items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red"
                  onClick={() => selectItem(item)}
                >
                  <ItemLabel item={item} />
                  <HiArrowRight
                    className="h-5 w-5 shrink-0 text-rich-red"
                    aria-hidden="true"
                  />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderView = () => {
    switch (state.view.type) {
      case "home":
        return (
          <div className="space-y-3">
            <div
              className="flex animate-fade-in flex-col items-center pb-5 text-center motion-reduce:animate-none"
              style={{ animationDelay: "140ms" }}
            >
              <Image
                src="/images/global/ev-church-logo.png"
                alt="Ev Church"
                width={60}
                height={60}
                priority
              />
              <h2 className="mt-4 text-2xl font-semibold text-brand-black">
                Take your next step here
              </h2>
            </div>
            <LauncherActionButton
              title="Plan a Visit"
              animationDelay={195}
              featured
              onClick={() =>
                pushView({
                  type: "workflow",
                  title: "Plan a Visit",
                  workflowTypeGuid: PLAN_A_VISIT_WORKFLOW_GUID,
                  imageUrl: PLAN_A_VISIT_IMAGE_URL,
                })
              }
            />
            <a
              href="/give"
              className="group flex w-full animate-fade-in items-center justify-between gap-4 rounded-2xl border border-warm-grey/70 bg-white px-5 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-rich-red/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red motion-reduce:animate-none"
              style={{ animationDelay: "250ms" }}
            >
              <span className="block text-lg font-semibold text-brand-black">
                Give Now
              </span>
              <HiArrowRight
                className="h-5 w-5 shrink-0 text-rich-red"
                aria-hidden="true"
              />
            </a>
            <LauncherActionButton
              title="Connect Card"
              animationDelay={305}
              onClick={() =>
                pushView({
                  type: "workflow",
                  title: "Connect Card",
                  workflowTypeGuid: CONNECT_CARD_WORKFLOW_GUID,
                  imageUrl: connectCardImageUrl,
                })
              }
            />
            <LauncherActionButton
              title="See more next steps"
              animationDelay={360}
              onClick={() => pushView({ type: "catalogue" })}
            />
            {feedback && (
              <LauncherActionButton
                title="New website feedback"
                animationDelay={415}
                onClick={() =>
                  pushView({ type: "feedback", title: feedback.modalTitle })
                }
              />
            )}
          </div>
        );
      case "catalogue":
        return renderCatalogue();
      case "giving":
        return giving.givingExperience ? (
          <div className="h-full" data-giving-private>{giving.givingExperience}</div>
        ) : null;
      case "feedback":
        return feedback ? (
          <FeedbackStrip
            embedded
            settings={feedback}
            signedInEmail={signedInEmail}
            onEmbeddedClose={() => dispatch({ type: "back" })}
          />
        ) : null;
      case "workflow":
        return (
          <div className="animate-fade-in motion-reduce:animate-none">
            <LauncherBanner
              imageUrl={state.view.imageUrl}
              bleed={state.presentation !== "fullscreen"}
            />
            <RockForm
              workflowTypeGuid={state.view.workflowTypeGuid}
              scrollContainerRef={scrollRef}
            />
          </div>
        );
      case "connection":
        return (
          <div className="animate-fade-in motion-reduce:animate-none">
            <LauncherBanner
              imageUrl={state.view.imageUrl}
              bleed={state.presentation !== "fullscreen"}
            />
            <RockConnectionOpportunitySignup blockGuid={state.view.blockGuid} />
          </div>
        );
      case "content":
        return (
          <div className="animate-fade-in motion-reduce:animate-none">
            <LauncherBanner
              imageUrl={state.view.imageUrl}
              constrainToContent={state.presentation === "fullscreen"}
            />
            <div className="prose prose-neutral mx-auto max-w-2xl px-4 sm:px-6">
              <SafeRockHtml value={state.view.html} />
            </div>
          </div>
        );
    }
  };

  return (
    <div ref={launcherRootRef} className="relative z-[9999] print:hidden">
      {state.presentation !== "collapsed" && (
        <div
          className={
            state.presentation === "fullscreen"
              ? `fixed inset-0 bg-brand-black/45 p-0 backdrop-blur-sm transition-opacity duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none sm:p-5 ${
                  isClosing
                    ? isCloseMotionActive
                      ? "opacity-0"
                      : "opacity-100"
                    : "animate-fade-in"
                }`
              : "pointer-events-none fixed inset-0 flex items-end justify-end p-3 pb-[max(5rem,calc(env(safe-area-inset-bottom)+4.25rem))] sm:p-6 sm:pb-24"
          }
        >
          <div
            ref={panelRef}
            role={state.presentation === "fullscreen" ? "dialog" : "region"}
            aria-modal={
              state.presentation === "fullscreen" ? "true" : undefined
            }
            aria-label="Next steps launcher"
            data-state={isClosing ? "closing" : "open"}
            tabIndex={-1}
            onTransitionEnd={(event) => {
              if (
                isClosing &&
                isCloseMotionActive &&
                event.currentTarget === event.target &&
                event.propertyName === "opacity"
              ) {
                completeClose();
              }
            }}
            className={
              state.presentation === "fullscreen"
                ? `flex h-full w-full flex-col overflow-hidden bg-warm-white shadow-2xl outline-none transition-[translate,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[translate,opacity] motion-reduce:animate-none motion-reduce:transition-none sm:mx-auto sm:max-w-5xl sm:rounded-[2rem] ${
                    isClosing
                      ? isCloseMotionActive
                        ? "translate-y-3 opacity-0"
                        : "translate-y-0 opacity-100"
                      : "translate-y-0 animate-fade-in-up opacity-100"
                  }`
                : `pointer-events-auto flex h-[min(44rem,calc(100dvh-5.75rem))] w-full flex-col overflow-hidden rounded-[1.75rem] border border-white/50 bg-warm-white shadow-2xl outline-none transition-[translate,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[translate,opacity] motion-reduce:animate-none motion-reduce:transition-none sm:w-[26rem] ${
                    isClosing
                      ? isCloseMotionActive
                        ? "translate-y-3 opacity-0"
                        : "translate-y-0 opacity-100"
                      : "translate-y-0 animate-fade-in-up opacity-100"
                  }`
            }
          >
            <header className="relative flex min-h-[4.5rem] shrink-0 items-center justify-center bg-warm-white px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-2 sm:px-5">
              {state.history.length > 0 && (
                <div className="absolute left-4 top-[max(.75rem,env(safe-area-inset-top))] sm:left-5">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-black shadow-sm transition hover:bg-warm-grey/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red"
                    aria-label="Back"
                    onClick={() => {
                      if (state.view.type === "giving" && giving.handleGivingBack()) return;
                      dispatch({ type: "back" });
                    }}
                  >
                    <HiArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              )}
              <div className="absolute right-4 top-[max(.75rem,env(safe-area-inset-top))] flex items-center gap-1 sm:right-5">
                {(memberProfile !== undefined || adminHref) && (
                  <MemberAccountControl
                    profile={memberProfile ?? null}
                    variant="mobile-icon"
                    tone="dark"
                    active={!isClosing}
                    adminHref={adminHref}
                  />
                )}
                {!isMobile && (
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-black shadow-sm transition hover:bg-warm-grey/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red"
                    aria-label={
                      state.presentation === "fullscreen"
                        ? "Exit full screen"
                        : "Open full screen"
                    }
                    onClick={() => dispatch({ type: "toggleFullscreen" })}
                  >
                    {state.presentation === "fullscreen" ? (
                      <HiArrowsPointingIn
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    ) : (
                      <HiArrowsPointingOut
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )}
              </div>
              {state.view.type !== "home" && (
                <h2 className="min-w-0 max-w-[calc(100%-7rem)] truncate text-center text-lg font-semibold text-brand-black sm:text-xl">
                  {viewTitle(state.view)}
                </h2>
              )}
            </header>
            <div
              ref={scrollRef}
              className={
                state.view.type === "content"
                  ? "min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6"
                  : `min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6 ${
                      formViewHasBanner ? "pt-0" : "pt-2 sm:pt-3"
                    }`
              }
            >
              <div
                className={
                  state.view.type === "content"
                    ? "w-full"
                    : `mx-auto w-full max-w-2xl ${state.view.type === "giving" ? "h-full" : ""}`
                }
              >
                {renderView()}
              </div>
            </div>
          </div>
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        className="fixed right-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-[1] flex h-14 w-14 items-center justify-center rounded-full bg-rich-red text-white shadow-xl shadow-brand-black/20 transition-[transform,background-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:bg-deep-red hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-4 sm:right-6 sm:bottom-6 sm:h-16 sm:w-16"
        aria-label={
          state.presentation === "collapsed" || isClosing
            ? "Open next steps"
            : "Close next steps"
        }
        aria-expanded={state.presentation !== "collapsed" && !isClosing}
        onClick={() => {
          if (isClosing) {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
            restoreTriggerFocusRef.current = false;
            setIsClosing(false);
            setIsCloseMotionActive(false);
            return;
          }
          if (state.presentation === "collapsed") {
            dispatch({
              type: "open",
              presentation: isMobile ? "fullscreen" : "compact",
            });
          } else close();
        }}
      >
        <span className="relative h-6 w-6" aria-hidden="true">
          <HiRocketLaunch
            className={`absolute inset-0 h-6 w-6 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              state.presentation === "collapsed" || isClosing
                ? "rotate-0 scale-100 opacity-100"
                : "rotate-[225deg] scale-75 opacity-0"
            }`}
          />
          <HiXMark
            className={`absolute inset-0 h-6 w-6 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              state.presentation === "collapsed" || isClosing
                ? "-rotate-[225deg] scale-75 opacity-0"
                : "rotate-0 scale-100 opacity-100"
            }`}
          />
        </span>
      </button>
    </div>
  );
}

function ItemLabel({ item }: { item: LauncherItem }) {
  return (
    <span className="min-w-0">
      <span className="block font-semibold text-brand-black">{item.title}</span>
    </span>
  );
}
