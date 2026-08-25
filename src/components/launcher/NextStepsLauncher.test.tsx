// @vitest-environment happy-dom

import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = {
  pathname: "/about",
};
const mediaPlayer = vi.hoisted(() => ({
  isVideoExpanded: true,
  minimizeVideo: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    replace: (href: string) => window.history.replaceState(null, "", href),
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/components/audio/AudioPlayerProvider", () => ({
  useAudioPlayer: () => mediaPlayer,
}));
vi.mock("@/components/forms/RockForm", () => ({
  RockForm: ({ workflowTypeGuid, groupGuid }: { workflowTypeGuid: string; groupGuid?: string }) => (
    <label>
      Form draft
      <input aria-label={`Workflow ${workflowTypeGuid}`} data-group-guid={groupGuid} />
    </label>
  ),
}));
vi.mock("@/components/forms/RockConnectionOpportunitySignup", () => ({
  RockConnectionOpportunitySignup: ({ blockGuid }: { blockGuid: string }) => (
    <div data-connection-guid={blockGuid}>Connection signup</div>
  ),
}));
vi.mock("@/components/forms/SafeRockHtml", () => ({
  SafeRockHtml: ({ value }: { value: string }) => (
    <div data-safe-html={value} />
  ),
}));
vi.mock("@/components/events/RegistrationFrame", () => ({
  RegistrationFrame: ({ src, title }: { src: string; title: string }) => (
    <div data-registration-frame data-src={src} data-title={title} />
  ),
}));

import {
  launcherShareHref,
  launcherShareTarget,
  NextStepsLauncher,
  safeConnectGroupGuid,
  safeRegistrationInstanceId,
} from "./NextStepsLauncher";
import {
  registrationPageHref,
  validateRegistrationPagePath,
} from "@/lib/rock-forms/registration-page";
import {
  OPEN_EVENT_REGISTRATION,
  type OpenEventRegistrationDetail,
} from "@/components/events/EventRegistrationAction";
import { Header } from "@/components/layout/Header";
import {
  GivingExperienceProvider,
  useGivingExperience,
} from "@/components/giving/GivingExperienceProvider";
import {
  CONNECT_CARD_WORKFLOW_GUID,
  CONNECT_GROUP_WORKFLOW_GUID,
  LAUNCHER_CAMPUS_STORAGE_KEY,
  PLAN_A_VISIT_WORKFLOW_GUID,
} from "@/lib/launcher/constants";
import type { LauncherItem } from "@/lib/launcher/types";
import type { PublicSiteFeedbackSettings } from "@/lib/site-feedback/settings";
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const campuses = [
  { slug: "north", name: "North" },
  { slug: "central", name: "Central" },
  { slug: "unichurch", name: "UniChurch" },
];

const items: LauncherItem[] = [
  {
    id: "1",
    title: "Join a Group",
    promotionalBlurb: "Find community",
    searchText: "Meet during the week",
    campusSlugs: ["north"],
    action: { type: "content", html: "<p>Groups</p>" },
  },
  {
    id: "2",
    title: "Central Kids",
    promotionalBlurb: "For families",
    campusSlugs: ["central"],
    action: { type: "directLink", href: "https://example.com/kids" },
  },
];

const feedback: PublicSiteFeedbackSettings = {
  bannerCopy: "Help us improve the new ev.church.",
  ctaLabel: "Share feedback.",
  modalTitle: "Share your feedback",
  modalIntro: "Tell us what is working well or what we could improve.",
  dismissalVersion: "v1",
  turnstileSiteKey: "site-key",
};

function button(container: HTMLElement, name: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>("button"),
  ).find(
    (candidate) =>
      candidate.textContent?.includes(name) ||
      candidate.getAttribute("aria-label") === name,
  );
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function chooseCampus(container: HTMLElement, campus: string) {
  await act(async () => button(container, "Central")?.click());
  await act(async () => {
    const option = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    ).find((candidate) => candidate.textContent?.includes(campus));
    option?.click();
  });
}

function hasImageSource(container: HTMLElement, source: string) {
  return Array.from(container.querySelectorAll<HTMLImageElement>("img")).some(
    (image) =>
      decodeURIComponent(image.getAttribute("src") || "").includes(source),
  );
}

function mockMobileViewport(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      media: "(max-width: 639px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function EnableGiving() {
  const giving = useGivingExperience();
  return <button type="button" data-enable-giving onClick={() => giving.setFlagState("enabled")} />;
}

function OpenGivingProbe() {
  const giving = useGivingExperience();
  return <button type="button" data-open-giving onClick={() => giving.openGiving()} />;
}

function GivingHistoryProbe() {
  const giving = useGivingExperience();
  const [step, setStep] = useState(2);
  useEffect(() => giving.registerGivingBackHandler(() => {
    if (step === 0) return false;
    setStep((value) => value - 1);
    return true;
  }), [giving.registerGivingBackHandler, step]);
  return <output data-giving-step>{step}</output>;
}

function GivingSubmitGuardProbe() {
  const giving = useGivingExperience();
  useEffect(() => giving.registerGivingBackHandler(() => true), [giving.registerGivingBackHandler]);
  useEffect(() => giving.registerGivingCloseHandler(() => true), [giving.registerGivingCloseHandler]);
  return <output data-giving-submit-guard data-active={giving.givingViewActive}>Submitting</output>;
}

function GivingActiveProbe() {
  const giving = useGivingExperience();
  return <output data-giving-active>{String(giving.givingViewActive)}</output>;
}

describe("NextStepsLauncher", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mediaPlayer.isVideoExpanded = true;
    navigation.pathname = "/about";
    window.history.replaceState(null, "", "/about");
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockMobileViewport(false);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses one icon-only control to open and close the launcher", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(16), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) =>
      window.clearTimeout(id),
    );
    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    const toggle = button(container, "Open next steps")!;
    expect(toggle.textContent?.trim()).toBe("");

    await act(async () => toggle.click());

    expect(mediaPlayer.minimizeVideo).toHaveBeenCalledTimes(1);
    expect(toggle.isConnected).toBe(true);
    expect(toggle.getAttribute("aria-label")).toBe("Close next steps");
    const share = button(container, "Share Your next step")!;
    expect(share.querySelector("[data-launcher-link-icon]")).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Next steps launcher"]')?.className,
    ).toContain("transition-[translate,opacity]");
    expect(
      container
        .querySelector('[aria-label="Next steps launcher"]')
        ?.querySelector('[aria-label="Close next steps"]'),
    ).toBeNull();

    await act(async () => toggle.click());

    expect(toggle.isConnected).toBe(true);
    expect(toggle.getAttribute("aria-label")).toBe("Open next steps");
    expect(share.isConnected).toBe(true);
    expect(share.className).toContain("animate-launcher-share-hide");
    expect(share.disabled).toBe(true);
    expect(
      container.querySelector('[aria-label="Next steps launcher"]'),
    ).not.toBeNull();
    expect(
      container
        .querySelector('[aria-label="Next steps launcher"]')
        ?.getAttribute("data-state"),
    ).toBe("closing");
    expect(
      container.querySelector('[aria-label="Next steps launcher"]')?.className,
    ).toContain("translate-y-0");

    await act(async () => vi.advanceTimersByTime(16));

    expect(
      container.querySelector('[aria-label="Next steps launcher"]')?.className,
    ).toContain("translate-y-3");

    await act(async () => vi.advanceTimersByTime(200));

    const closingPanel = container.querySelector(
      '[aria-label="Next steps launcher"]',
    )!;
    expect(closingPanel).not.toBeNull();

    const transitionEnd = new Event("transitionend", { bubbles: true });
    Object.defineProperty(transitionEnd, "propertyName", {
      value: "opacity",
    });
    await act(async () => closingPanel.dispatchEvent(transitionEnd));

    expect(
      container.querySelector('[aria-label="Next steps launcher"]'),
    ).toBeNull();
  });

  it("opens fullscreen by default and removes the fullscreen control on mobile", async () => {
    mockMobileViewport(true);
    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    await act(async () => button(container, "Open next steps")?.click());

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.parentElement?.className).toContain(
      "pb-[max(5rem,calc(env(safe-area-inset-bottom)+4.25rem))]",
    );
    expect(dialog?.parentElement?.className).toContain("sm:p-5");
    expect(button(container, "Open full screen")).toBeUndefined();
    expect(button(container, "Exit full screen")).toBeUndefined();
  });

  it("shows the four primary actions in order and opens the exact workflows", async () => {
    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });
    await act(async () => button(container, "Open next steps")?.click());

    const panelText =
      container.querySelector('[aria-label="Next steps launcher"]')
        ?.textContent || "";
    const actionNames = [
      "Plan a Visit",
      "Give Now",
      "Connect Card",
      "See more next steps",
    ];
    expect(panelText).toContain("Take your next step here");
    expect(panelText).not.toContain("Your next step");
    expect(container.querySelector('img[alt="Ev Church"]')).not.toBeNull();
    expect(button(container, "Open full screen")?.className).toContain(
      "rounded-full",
    );
    expect(
      button(container, "Open full screen")?.parentElement?.className,
    ).toContain("w-24");
    expect(panelText.indexOf("Plan a Visit")).toBeLessThan(
      panelText.indexOf("Give Now"),
    );
    expect(panelText.indexOf("Give Now")).toBeLessThan(
      panelText.indexOf("Connect Card"),
    );
    expect(panelText.indexOf("Connect Card")).toBeLessThan(
      panelText.indexOf("See more next steps"),
    );
    expect(panelText).not.toContain("Choose a campus and let us know");
    expect(panelText).not.toContain(
      "Give securely through the Ev Church website",
    );
    expect(panelText).not.toContain(
      "Introduce yourself or ask us to get in touch",
    );
    expect(panelText).not.toContain(
      "Explore everything available at your campus",
    );
    expect(container.querySelector('a[href="?launcher=give"]')).not.toBeNull();
    expect(button(container, "Plan a Visit")?.className).toContain("py-6");
    expect(container.querySelector('a[href="?launcher=give"]')?.className).not.toContain(
      "py-6",
    );

    await act(async () => button(container, "Plan a Visit")?.click());
    expect(
      container.querySelector(
        `input[aria-label="Workflow ${PLAN_A_VISIT_WORKFLOW_GUID}"]`,
      ),
    ).not.toBeNull();
    expect(button(container, "Back")?.parentElement?.className).toContain(
      "w-24",
    );
    expect(
      button(container, "Open full screen")?.parentElement?.className,
    ).toContain("w-24");
    await act(async () => button(container, "Back")?.click());
    await act(async () => button(container, "Connect Card")?.click());
    expect(
      container.querySelector(
        `input[aria-label="Workflow ${CONNECT_CARD_WORKFLOW_GUID}"]`,
      ),
    ).not.toBeNull();
  });

  it("keeps one share control mounted while moving between launcher pages", async () => {
    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });
    await act(async () => button(container, "Open next steps")?.click());

    const homeShare = button(container, "Share Your next step");
    expect(homeShare).toBeTruthy();

    await act(async () => button(container, "See more next steps")?.click());
    expect(button(container, "Share More next steps")).toBe(homeShare);
  });

  it("opens the Connect Card when the homepage carries the connect launcher state", async () => {
    navigation.pathname = "/";
    window.history.replaceState(null, "", "/?launcher=connect");

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    expect(
      container.querySelector(
        `input[aria-label="Workflow ${CONNECT_CARD_WORKFLOW_GUID}"]`,
      ),
    ).not.toBeNull();
    expect(button(container, "Back")).toBeTruthy();
    expect(button(container, "Close next steps")).toBeTruthy();
  });

  it("restores the page position after a same-page launcher link opens", async () => {
    const scrollY = vi.spyOn(window, "scrollY", "get").mockReturnValue(480);
    const scrollTo = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => undefined);

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    const link = document.createElement("a");
    link.href = "/about?launcher=home";
    link.textContent = "Open launcher";
    document.body.appendChild(link);
    link.click();
    link.remove();

    await act(async () => root.unmount());
    root = createRoot(container);
    scrollY.mockReturnValue(0);
    window.history.replaceState(null, "", "/about?launcher=home");
    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    expect(scrollTo).toHaveBeenCalledWith(0, 480);
  });

  it("does not restore scroll when a launcher URL is loaded directly", async () => {
    const scrollTo = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => undefined);
    window.history.replaceState(null, "", "/about?launcher=home");

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("opens the Connect Group workflow with the selected group", async () => {
    const groupGuid = "9756a8fd-a865-4070-add3-03b3396c4b9a";
    navigation.pathname = "/connect-groups";
    window.history.replaceState(
      null,
      "",
      `/connect-groups?launcher=connect-group&groupGuid=${groupGuid}`,
    );

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    const form = container.querySelector(
      `input[aria-label="Workflow ${CONNECT_GROUP_WORKFLOW_GUID}"]`,
    );
    expect(form?.getAttribute("data-group-guid")).toBe(groupGuid);
    expect(button(container, "Share Join a Connect Group")).toBeTruthy();
  });

  it("opens giving from the validated giving launcher target", async () => {
    navigation.pathname = "/give";
    window.history.replaceState(null, "", "/give?launcher=give");

    await act(async () => {
      root.render(
        <GivingExperienceProvider
          serverEligibility="production"
          givingExperience={<section>Giving renderer seam</section>}
        >
          <NextStepsLauncher campuses={campuses} items={items} />
        </GivingExperienceProvider>,
      );
    });

    expect(container.querySelector("[data-giving-private]")?.textContent).toContain(
      "Giving renderer seam",
    );
    expect(button(container, "Back")).toBeTruthy();
    await act(async () => button(container, "Back")?.click());
    expect(window.location.search).toBe("");
    expect(container.textContent).toContain("Take your next step here");
  });

  it("clears a URL-owned target when the launcher closes", async () => {
    window.history.replaceState(null, "", "/?launcher=connect");

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });
    await act(async () => button(container, "Close next steps")?.click());

    expect(window.location.search).toBe("");
  });

  it("opens an eligible internal launcher item by its item id", async () => {
    navigation.pathname = "/campus/north";
    window.history.replaceState(null, "", "/campus/north?launcher=1");

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    expect(container.querySelector('[data-safe-html="<p>Groups</p>"]')).not.toBeNull();
    expect(button(container, "Back")).toBeTruthy();
  });

  it("keeps long detail titles aligned and ellipsized between the header controls", async () => {
    navigation.pathname = "/campus/north";
    window.history.replaceState(null, "", "/campus/north?launcher=long-title");
    const longTitleItem: LauncherItem = {
      ...items[0],
      id: "long-title",
      title: "A very long launcher title that must not sit underneath the controls",
    };

    await act(async () => {
      root.render(
        <NextStepsLauncher
          campuses={campuses}
          items={[...items, longTitleItem]}
          memberProfile={null}
        />,
      );
    });

    const title = Array.from(container.querySelectorAll("h2")).find(
      (heading) => heading.textContent === longTitleItem.title,
    );
    const header = title?.parentElement?.parentElement;
    expect(header?.tagName).toBe("HEADER");
    expect(title?.className).toContain("h-10");
    expect(title?.className).toContain("items-center");
    expect(title?.parentElement?.className).toContain("min-w-0");
    expect(title?.querySelector("span")?.className).toContain("truncate");
    expect(button(container, "Back")?.parentElement?.className).toContain("w-24");
    expect(
      container.querySelector('[aria-label="Sign in"]')?.parentElement?.className,
    ).toContain("w-24");
  });

  it("opens a Payload Rock form by its URL key with rich content above the form", async () => {
    const formGuid = "33333333-3333-3333-3333-333333333333";
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...window.navigator,
      share,
    });
    const rockForm: LauncherItem = {
      id: "managed-rock-form",
      title: "Managed Rock form",
      campusSlugs: [],
      action: {
        type: "workflow",
        workflowTypeGuid: formGuid,
        body: {
          root: {
            children: [
              {
                type: "paragraph",
                children: [{ type: "text", text: "Register each child." }],
              },
            ],
          },
        },
      },
    };
    window.history.replaceState(null, "", "/kids?launcher=managed-rock-form");

    await act(async () => {
      root.render(
        <NextStepsLauncher campuses={campuses} items={[...items, rockForm]} />,
      );
    });

    expect(container.textContent).toContain("Register each child.");
    expect(
      container.querySelector(`input[aria-label="Workflow ${formGuid}"]`),
    ).not.toBeNull();
    const shareButton = button(container, "Share Managed Rock form");
    const closeButton = button(container, "Close next steps");
    expect(shareButton).toBeTruthy();
    expect(shareButton?.parentElement).toBe(closeButton?.parentElement);
    expect(shareButton?.parentElement?.className).toContain("fixed");
    expect(shareButton?.parentElement?.className).toContain("gap-2");
    expect(shareButton?.className).toContain("animate-launcher-share-reveal");
    expect(shareButton?.className).toContain("motion-reduce:animate-none");
    expect(shareButton?.querySelector("[data-launcher-link-icon]")).not.toBeNull();
    await act(async () => button(container, "Share Managed Rock form")?.click());
    expect(share).toHaveBeenCalledWith({
      title: "Managed Rock form",
      url: `${window.location.origin}/?launcher=managed-rock-form`,
    });
  });

  it("opens a managed Connection Opportunity by its URL key with rich content", async () => {
    const connectionForm: LauncherItem = {
      id: "newish-connect",
      title: "Newish Connect",
      campusSlugs: [],
      action: {
        type: "connection",
        blockGuid: "22222222-2222-2222-2222-222222222222",
        body: {
          root: {
            children: [
              {
                type: "paragraph",
                children: [{ type: "text", text: "Register your interest." }],
              },
            ],
          },
        },
      },
    };
    window.history.replaceState(null, "", "/newish?launcher=newish-connect");

    await act(async () => {
      root.render(
        <NextStepsLauncher campuses={campuses} items={[...items, connectionForm]} />,
      );
    });

    expect(container.textContent).toContain("Register your interest.");
    expect(
      container.querySelector(
        '[data-connection-guid="22222222-2222-2222-2222-222222222222"]',
      ),
    ).not.toBeNull();
    expect(button(container, "Share Newish Connect")).toBeTruthy();
  });

  it("opens and shares a Registration-site page managed by a Rock Form record", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...window.navigator, share });
    navigation.pathname = "/kids";
    const registrationPage: LauncherItem = {
      id: "kids-enrolment",
      title: "Kids Enrolment",
      campusSlugs: [],
      action: {
        type: "registrationPage",
        href: "https://registration.ev.church/kids",
        imageUrl: "/images/kids.jpg",
        body: {
          root: {
            children: [{
              type: "paragraph",
              children: [{ type: "text", text: "Register your family." }],
            }],
          },
        },
      },
    };
    window.history.replaceState(null, "", "/kids?launcher=kids-enrolment");

    await act(async () => {
      root.render(
        <NextStepsLauncher campuses={campuses} items={[...items, registrationPage]} />,
      );
    });

    const frame = container.querySelector<HTMLElement>(
      "[data-registration-frame]",
    );
    expect(frame?.getAttribute("data-src")).toBe(
      "https://registration.ev.church/kids",
    );
    expect(frame?.getAttribute("data-title")).toBe("Kids Enrolment");
    expect(container.textContent).toContain("Register your family.");
    expect(hasImageSource(container, "/images/kids.jpg")).toBe(true);
    expect(button(container, "Close next steps")).toBeTruthy();
    await act(async () => button(container, "Share Kids Enrolment")?.click());
    expect(share).toHaveBeenCalledWith({
      title: "Kids Enrolment",
      url: `${window.location.origin}/kids?launcher=kids-enrolment`,
    });
  });

  it("builds launcher share links from the site root", () => {
    expect(launcherShareHref("kids enrolment")).toBe(
      "/?launcher=kids%20enrolment",
    );
    expect(
      launcherShareHref("registration", "/events/next-steps", {
        registrationInstanceId: "81",
      }),
    ).toBe(
      "/events/next-steps?launcher=registration&registrationInstanceId=81",
    );
    expect(launcherShareHref("registration", "//evil.test")).toBe(
      "/?launcher=registration",
    );
  });

  it("copies the launcher link when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...window.navigator,
      clipboard: { writeText },
      share: undefined,
    });
    window.history.replaceState(null, "", "/?launcher=home");

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });
    await act(async () => button(container, "Share Your next step")?.click());

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?launcher=home`);
    expect(button(container, "Link copied")).toBeTruthy();
  });

  it("does not show a stale copy result after the launcher starts closing", async () => {
    let resolveCopy: (() => void) | undefined;
    const writeText = vi.fn(
      () => new Promise<void>((resolve) => {
        resolveCopy = resolve;
      }),
    );
    vi.stubGlobal("navigator", {
      ...window.navigator,
      clipboard: { writeText },
      share: undefined,
    });
    window.history.replaceState(null, "", "/?launcher=home");

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });
    await act(async () => button(container, "Share Your next step")?.click());
    await act(async () => button(container, "Close next steps")?.click());
    await act(async () => resolveCopy?.());

    expect(button(container, "Link copied")).toBeFalsy();
  });

  it("assigns a share target to every built-in launcher page", () => {
    expect(launcherShareTarget({ type: "home" })).toBe("home");
    expect(launcherShareTarget({ type: "catalogue" })).toBe("catalogue");
    expect(launcherShareTarget({ type: "giving" })).toBe("give");
    expect(
      launcherShareTarget({ type: "feedback", title: "Website feedback" }),
    ).toBe("feedback");
    expect(
      launcherShareTarget({
        type: "registration",
        href: "https://registration.ev.church/?RegistrationInstanceId=81",
        registrationInstanceId: 81,
        title: "Registration",
      }),
    ).toBe("registration");
    expect(
      launcherShareTarget({
        type: "registrationPage",
        href: "https://registration.ev.church/kids",
        shareTarget: "kids-enrolment",
        title: "Kids Enrolment",
      }),
    ).toBe("kids-enrolment");
  });

  it("ignores launcher targets that do not resolve to an internal view", async () => {
    navigation.pathname = "/";
    window.history.replaceState(null, "", "/?launcher=2");

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    expect(button(container, "Close next steps")).toBeFalsy();
    expect(button(container, "Open next steps")).toBeTruthy();
  });

  it.each([
    ["home", "Take your next step here"],
    ["catalogue", "More next steps"],
  ])("opens the %s built-in launcher target", async (target, expectedText) => {
    window.history.replaceState(null, "", `/?launcher=${target}`);

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    expect(container.textContent).toContain(expectedText);
    expect(button(container, "Close next steps")).toBeTruthy();
  });

  it("opens the visit built-in launcher target", async () => {
    window.history.replaceState(null, "", "/?launcher=visit");

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    expect(container.querySelector(
      `input[aria-label="Workflow ${PLAN_A_VISIT_WORKFLOW_GUID}"]`,
    )).not.toBeNull();
  });

  it("opens feedback from its built-in launcher target", async () => {
    window.history.replaceState(null, "", "/?launcher=feedback");

    await act(async () => {
      root.render(
        <NextStepsLauncher campuses={campuses} items={items} feedback={feedback} />,
      );
    });

    expect(container.textContent).toContain(feedback.modalTitle);
    expect(container.querySelector('textarea[name="comment"]')).not.toBeNull();
  });

  it.each([
    ["give", "unavailable giving"],
    ["feedback", "unavailable feedback"],
    ["x".repeat(129), "overlong target"],
  ])("ignores %s when it is an %s target", async (target) => {
    window.history.replaceState(null, "", `/?launcher=${target}`);

    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });

    expect(button(container, "Close next steps")).toBeFalsy();
    expect(button(container, "Open next steps")).toBeTruthy();
  });

  it.each([
    {
      item: {
        id: "workflow-item",
        title: "Workflow item",
        campusSlugs: [],
        action: { type: "workflow" as const, workflowTypeGuid: "workflow-guid" },
      },
      selector: 'input[aria-label="Workflow workflow-guid"]',
    },
    {
      item: {
        id: "connection-item",
        title: "Connection item",
        campusSlugs: [],
        action: { type: "connection" as const, blockGuid: "connection-guid" },
      },
      selector: '[data-connection-guid="connection-guid"]',
    },
  ])("opens the $item.action.type internal item target", async ({ item, selector }) => {
    window.history.replaceState(null, "", `/?launcher=${item.id}`);

    await act(async () => {
      root.render(
        <NextStepsLauncher campuses={campuses} items={[...items, item]} />,
      );
    });

    expect(container.querySelector(selector)).not.toBeNull();
  });

  it("closes a URL-owned launcher view when navigation removes the target", async () => {
    navigation.pathname = "/give";
    window.history.replaceState(null, "", "/give?launcher=give");
    const renderLauncher = () => (
        <GivingExperienceProvider
          serverEligibility="production"
          givingExperience={<section>Giving renderer seam</section>}
        >
          <NextStepsLauncher campuses={campuses} items={items} />
        </GivingExperienceProvider>
      );

    await act(async () => root.render(renderLauncher()));
    expect(container.querySelector("[data-giving-private]")).not.toBeNull();

    window.history.replaceState(null, "", "/give");
    await act(async () => root.render(renderLauncher()));

    expect(container.querySelector("[data-giving-private]")).toBeNull();
    expect(button(container, "Open next steps")).toBeTruthy();
  });

  it("does not open an old-campus item during a campus route change", async () => {
    navigation.pathname = "/campus/north";
    window.history.replaceState(null, "", "/campus/north?launcher=1");
    const renderLauncher = () => (
      <NextStepsLauncher campuses={campuses} items={items} />
    );

    await act(async () => root.render(renderLauncher()));
    expect(container.querySelector('[data-safe-html="<p>Groups</p>"]')).not.toBeNull();

    navigation.pathname = "/campus/central";
    window.history.replaceState(null, "", "/campus/central?launcher=1");
    await act(async () => root.render(renderLauncher()));

    expect(container.querySelector('[data-safe-html="<p>Groups</p>"]')).toBeNull();
    expect(button(container, "Open next steps")).toBeTruthy();
  });

  it("points desktop, mobile, and launcher giving actions at the validated giving target", async () => {
    await act(async () => {
      root.render(
        <GivingExperienceProvider
          serverEligibility="production"
          givingExperience={<section>Giving renderer seam</section>}
        >
          <EnableGiving />
          <Header />
          <NextStepsLauncher campuses={campuses} items={items} memberProfile={null} />
        </GivingExperienceProvider>,
      );
    });
    const desktopGive = container.querySelector<HTMLAnchorElement>("header [data-header-give]")!;
    expect(desktopGive.getAttribute("href")).toBe("?launcher=give");
    await act(async () => button(container, "Open next steps")?.click());
    expect(container.querySelector<HTMLAnchorElement>(
      '[aria-label="Next steps launcher"] a[href="?launcher=give"]',
    )).not.toBeNull();
    const mobileGive = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[href="?launcher=give"]'),
    ).find((anchor) => anchor.textContent?.trim() === "Give" && !anchor.hasAttribute("data-header-give"))!;
    expect(mobileGive).toBeTruthy();
  });

  it("uses the shared launcher Back control for giving history before exiting giving", async () => {
    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility="production" givingExperience={<GivingHistoryProbe />}>
        <EnableGiving />
        <OpenGivingProbe />
        <NextStepsLauncher campuses={campuses} items={items} />
      </GivingExperienceProvider>,
    ));
    await act(async () => container.querySelector<HTMLButtonElement>("[data-enable-giving]")?.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-open-giving]')?.click());
    expect(container.querySelector('[data-giving-step]')?.textContent).toBe('2');

    await act(async () => button(container, "Back")?.click());
    expect(container.querySelector('[data-giving-step]')?.textContent).toBe('1');
    expect(container.querySelector('[data-giving-private]')).not.toBeNull();
    await act(async () => button(container, "Back")?.click());
    expect(container.querySelector('[data-giving-step]')?.textContent).toBe('0');
    await act(async () => button(container, "Back")?.click());
    expect(container.querySelector('[data-giving-private]')).toBeNull();
    expect(container.textContent).toContain('Take your next step here');
  });

  it("keeps the giving view open when a checkout submit consumes Back, Close, and Escape", async () => {
    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility="production" givingExperience={<GivingSubmitGuardProbe />}>
        <EnableGiving />
        <OpenGivingProbe />
        <NextStepsLauncher campuses={campuses} items={items} />
      </GivingExperienceProvider>,
    ));
    await act(async () => container.querySelector<HTMLButtonElement>("[data-enable-giving]")?.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-open-giving]')?.click());
    expect(container.querySelector('[data-giving-submit-guard]')?.getAttribute('data-active')).toBe('true');

    await act(async () => button(container, "Back")?.click());
    expect(container.querySelector('[data-giving-submit-guard]')).not.toBeNull();
    await act(async () => button(container, "Close next steps")?.click());
    expect(container.querySelector('[data-giving-submit-guard]')).not.toBeNull();
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[data-giving-submit-guard]')).not.toBeNull();
  });

  it("marks giving inactive as soon as an allowed launcher close begins", async () => {
    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility="production" givingExperience={<GivingActiveProbe />}>
        <EnableGiving />
        <OpenGivingProbe />
        <NextStepsLauncher campuses={campuses} items={items} />
      </GivingExperienceProvider>,
    ));
    await act(async () => container.querySelector<HTMLButtonElement>("[data-enable-giving]")?.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-open-giving]')?.click());
    expect(container.querySelector('[data-giving-active]')?.textContent).toBe('true');
    await act(async () => button(container, "Close next steps")?.click());
    expect(container.querySelector('[data-giving-active]')?.textContent).toBe('false');
    expect(container.querySelector('[aria-label="Next steps launcher"]')).not.toBeNull();
  });

  it("keeps the giving launcher target on the current page before flag resolution", async () => {
    await act(async () => {
      root.render(
        <GivingExperienceProvider
          serverEligibility="production"
          givingExperience={<section>Giving renderer seam</section>}
        >
          <EnableGiving />
          <Header />
          <NextStepsLauncher campuses={campuses} items={items} />
        </GivingExperienceProvider>,
      );
    });
    const give = container.querySelector<HTMLAnchorElement>("header [data-header-give]")!;
    expect(give.href).toBe("http://localhost:3000/about?launcher=give");
    const modifiedClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    await act(async () => { give.dispatchEvent(modifiedClick) })
    expect(modifiedClick.defaultPrevented).toBe(false);
    expect(container.querySelector("[data-giving-private]")).toBeNull();
  });

  it("opens site feedback inside the launcher when feedback is enabled", async () => {
    await act(async () => {
      root.render(
        <NextStepsLauncher
          campuses={campuses}
          items={items}
          feedback={feedback}
          signedInEmail="aroha@example.com"
        />,
      );
    });
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => button(container, "New website feedback")?.click());

    expect(container.textContent).toContain("Share your feedback");
    expect(container.textContent).toContain(feedback.modalIntro);
    expect(container.querySelector('textarea[name="comment"]')).not.toBeNull();
    expect(container.querySelector('input[name="email"]')).toBeNull();

    await act(async () => button(container, "Back")?.click());
    expect(button(container, "New website feedback")).toBeTruthy();
  });

  it("preserves an active form through full screen and clears it on close", async () => {
    vi.useFakeTimers();
    await act(async () => {
      root.render(
        <>
          <main data-page-content>Page</main>
          <NextStepsLauncher campuses={campuses} items={items} />
        </>,
      );
    });
    const trigger = button(container, "Open next steps")!;
    await act(async () => trigger.click());
    await act(async () => button(container, "Plan a Visit")?.click());
    const field = container.querySelector<HTMLInputElement>(
      `input[aria-label="Workflow ${PLAN_A_VISIT_WORKFLOW_GUID}"]`,
    )!;
    field.value = "We are coming";

    await act(async () => button(container, "Open full screen")?.click());
    expect(
      container.querySelector('[role="dialog"]')?.getAttribute("aria-modal"),
    ).toBe("true");
    expect(
      container.querySelector<HTMLElement>("[data-page-content]")?.inert,
    ).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>(
        `input[aria-label="Workflow ${PLAN_A_VISIT_WORKFLOW_GUID}"]`,
      ),
    ).toBe(field);
    expect(field.value).toBe("We are coming");

    const fullscreenCloseTrigger = button(container, "Close next steps")!;
    fullscreenCloseTrigger.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(document.activeElement).toBe(button(container, "Back"));

    button(container, "Back")?.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(document.activeElement).toBe(fullscreenCloseTrigger);

    await act(async () => button(container, "Close next steps")?.click());
    expect(
      container.querySelector(
        `input[aria-label="Workflow ${PLAN_A_VISIT_WORKFLOW_GUID}"]`,
      ),
    ).toBe(field);
    await act(async () => vi.runAllTimers());
    const restoredTrigger = button(container, "Open next steps")!;
    expect(document.activeElement).toBe(restoredTrigger);
    await act(async () => restoredTrigger.click());
    expect(container.textContent).toContain("Plan a Visit");
    expect(
      container.querySelector(
        `input[aria-label="Workflow ${PLAN_A_VISIT_WORKFLOW_GUID}"]`,
      ),
    ).toBeNull();
  });

  it("shows the relevant 16:9 image above workflow and connection forms", async () => {
    const formItems: LauncherItem[] = [
      {
        id: "connect-card",
        title: "Connect",
        campusSlugs: [],
        action: {
          type: "workflow",
          workflowTypeGuid: CONNECT_CARD_WORKFLOW_GUID,
          imageUrl: "https://rock.ev.church/GetImage.ashx?Guid=connect&w=1200",
        },
      },
      {
        id: "connection",
        title: "Newish Connect",
        campusSlugs: ["north"],
        action: {
          type: "connection",
          blockGuid: "connection-block-guid",
          imageUrl: "https://rock.ev.church/GetImage.ashx?Guid=newish&w=1200",
        },
      },
    ];

    await act(async () => {
      root.render(
        <NextStepsLauncher
          campuses={campuses}
          items={formItems}
          initialPathname="/campus/north"
        />,
      );
    });
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => button(container, "Plan a Visit")?.click());
    expect(
      hasImageSource(container, "/images/homepage/carousel-146c7f7e.jpg"),
    ).toBe(true);
    expect(
      container.querySelector('img[alt=""]')?.parentElement?.className,
    ).toContain("aspect-video");
    expect(
      container.querySelector('img[alt=""]')?.parentElement?.parentElement
        ?.className,
    ).toContain("sm:-mx-6");
    expect(
      container.querySelector('img[alt=""]')?.closest(".overflow-y-auto")
        ?.className,
    ).not.toContain("pt-2");

    await act(async () => button(container, "Back")?.click());
    await act(async () => button(container, "Connect Card")?.click());
    expect(hasImageSource(container, "Guid=connect")).toBe(true);

    await act(async () => button(container, "Back")?.click());
    await act(async () => button(container, "See more next steps")?.click());
    await act(async () => button(container, "Newish Connect")?.click());
    expect(hasImageSource(container, "Guid=newish")).toBe(true);
  });

  it("infers campus, filters and searches in source order, and only stores campus changes", async () => {
    await act(async () => {
      root.render(
        <NextStepsLauncher
          campuses={campuses}
          items={items}
          initialPathname="/campus/north"
        />,
      );
    });
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => button(container, "See more next steps")?.click());

    expect(button(container, "North")?.getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(container.textContent).toContain("Join a Group");
    expect(container.textContent).not.toContain("Find community");
    expect(container.textContent).not.toContain("Central Kids");
    expect(window.localStorage.length).toBe(0);

    const search = container.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )!;
    await act(async () => {
      setInputValue(search, "DURING");
    });
    expect(container.textContent).toContain("Join a Group");

    await act(async () => button(container, "North")?.click());
    await act(async () => {
      const central = Array.from(
        container.querySelectorAll<HTMLButtonElement>('[role="option"]'),
      ).find((candidate) => candidate.textContent?.includes("Central"));
      central?.click();
    });
    expect(window.localStorage.getItem(LAUNCHER_CAMPUS_STORAGE_KEY)).toBe(
      "central",
    );
    expect(window.localStorage.length).toBe(1);
    expect(container.textContent).toContain("No next steps match your search");

    await act(async () => {
      setInputValue(search, "");
    });
    const direct = container.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/kids"]',
    );
    expect(direct?.target).toBe("_blank");
    expect(direct?.rel).toBe("noopener noreferrer");
  });

  it("defaults an anonymous visitor to Central", async () => {
    await act(async () => {
      root.render(
        <NextStepsLauncher
          campuses={campuses}
          items={items}
          initialPathname="/about"
        />,
      );
    });
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => button(container, "See more next steps")?.click());

    expect(button(container, "Central")).toBeTruthy();
    expect(container.textContent).not.toContain("Join a Group");
    expect(container.textContent).toContain("Central Kids");
    expect(
      container.querySelector<HTMLInputElement>('input[type="search"]')
        ?.disabled,
    ).toBe(false);
  });

  it("closes the campus menu before closing the launcher with Escape", async () => {
    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => button(container, "See more next steps")?.click());
    await act(async () => button(container, "Central")?.click());

    expect(container.querySelector('[role="listbox"]')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.querySelector('[aria-label="Next steps launcher"]')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(button(container, "Open next steps")).toBeTruthy();
  });

  it("does not reopen with a stale campus menu", async () => {
    await act(async () => {
      root.render(<NextStepsLauncher campuses={campuses} items={items} />);
    });
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => button(container, "See more next steps")?.click());
    await act(async () => button(container, "Central")?.click());
    await act(async () => button(container, "Close next steps")?.click());
    await act(async () => button(container, "Open next steps")?.click());

    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it("uses a signed-in member campus when there is no remembered choice", async () => {
    await act(async () => {
      root.render(
        <NextStepsLauncher
          campuses={campuses}
          items={items}
          initialPathname="/about"
          memberCampusSlug="north"
        />,
      );
    });
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => button(container, "See more next steps")?.click());

    expect(button(container, "North")).toBeTruthy();
    expect(container.textContent).toContain("Join a Group");
  });

  it("distinguishes a campus with no items from a search with no matches", async () => {
    await act(async () => {
      root.render(
        <NextStepsLauncher
          campuses={campuses}
          items={items}
          initialPathname="/campus/unichurch"
        />,
      );
    });
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => button(container, "See more next steps")?.click());

    expect(container.textContent).toContain(
      "There are no next steps available for this campus right now.",
    );
    expect(container.textContent).not.toContain(
      "No next steps match your search",
    );
  });

  it("renders resolved connection and custom actions inside and events on the main site", async () => {
    const actionItems: LauncherItem[] = [
      {
        id: "connection",
        title: "Get connected",
        campusSlugs: ["north"],
        action: { type: "connection", blockGuid: "connection-block-guid" },
      },
      {
        id: "content",
        title: "Learn more",
        campusSlugs: ["north"],
        action: {
          type: "content",
          html: "<p>Safe details</p>",
          imageUrl: "https://rock.ev.church/GetImage.ashx?Guid=detail&w=1200",
        },
      },
      {
        id: "event",
        title: "Upcoming event",
        campusSlugs: ["north"],
        action: { type: "event", href: "/events/upcoming-event" },
      },
      {
        id: "internal",
        title: "Kids",
        campusSlugs: ["north"],
        action: { type: "directLink", href: "/kids" },
      },
    ];
    await act(async () => {
      root.render(
        <NextStepsLauncher
          campuses={campuses}
          items={actionItems}
          initialPathname="/campus/north"
        />,
      );
    });
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => button(container, "See more next steps")?.click());

    expect(
      container.querySelector('a[href="/events/upcoming-event"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="/kids"]')?.getAttribute("target"),
    ).toBeNull();
    await act(async () => button(container, "Get connected")?.click());
    expect(
      container.querySelector('[data-connection-guid="connection-block-guid"]'),
    ).not.toBeNull();
    await act(async () => button(container, "Back")?.click());
    await act(async () => button(container, "Learn more")?.click());
    expect(
      container.querySelector('[data-safe-html="<p>Safe details</p>"]'),
    ).not.toBeNull();
    expect(container.querySelector('img[alt=""]')?.className).toContain(
      "w-full",
    );
    await act(async () => button(container, "Open full screen")?.click());
    expect(
      container.querySelector('img[alt=""]')?.parentElement?.parentElement
        ?.className,
    ).toContain("max-w-2xl");
    expect(container.textContent?.match(/Learn more/g)).toHaveLength(1);
  });

  it("opens an event registration form inside the launcher", async () => {
    await act(async () => {
      root.render(
        <NextStepsLauncher
          campuses={campuses}
          items={items}
          initialPathname="/events/next-steps"
        />,
      );
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent<OpenEventRegistrationDetail>(OPEN_EVENT_REGISTRATION, {
          detail: {
            registrationInstanceId: 81,
            title: "Next Steps",
          },
        }),
      );
    });

    const frame = container.querySelector<HTMLElement>(
      "[data-registration-frame]",
    );
    expect(frame?.getAttribute("data-src")).toBe(
      "https://registration.ev.church/?RegistrationInstanceId=81",
    );
    expect(frame?.getAttribute("data-title")).toBe("Register for Next Steps");
    expect(
      container.querySelector('[role="region"][aria-label="Next steps launcher"]'),
    ).not.toBeNull();
  });

  it("opens and shares a registration instance from any page", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...window.navigator, share });
    navigation.pathname = "/about";
    window.history.replaceState(
      null,
      "",
      "/about?launcher=registration&registrationInstanceId=81",
    );

    await act(async () => {
      root.render(
        <NextStepsLauncher
          campuses={campuses}
          items={items}
          initialPathname="/about"
        />,
      );
    });

    const frame = container.querySelector<HTMLElement>(
      "[data-registration-frame]",
    );
    expect(frame?.getAttribute("data-src")).toBe(
      "https://registration.ev.church/?RegistrationInstanceId=81",
    );

    await act(async () => button(container, "Share Registration")?.click());
    expect(share).toHaveBeenCalledWith({
      title: "Registration",
      url: `${window.location.origin}/about?launcher=registration&registrationInstanceId=81`,
    });
  });

  it("accepts only positive numeric registration instance IDs", () => {
    expect(safeRegistrationInstanceId("81")).toBe(81);
    expect(safeRegistrationInstanceId("0")).toBeNull();
    expect(safeRegistrationInstanceId("81x")).toBeNull();
    expect(safeRegistrationInstanceId("9007199254740992")).toBeNull();
  });

  it("accepts only valid Connect Group GUIDs", () => {
    expect(safeConnectGroupGuid("9756A8FD-A865-4070-ADD3-03B3396C4B9A")).toBe(
      "9756a8fd-a865-4070-add3-03b3396c4b9a",
    );
    expect(safeConnectGroupGuid("not-a-guid")).toBeNull();
    expect(safeConnectGroupGuid(null)).toBeNull();
  });

  it("accepts only constrained Registration-site paths", () => {
    expect(registrationPageHref("kids")).toBe("https://registration.ev.church/kids");
    expect(registrationPageHref("kids/pre-enrolment")).toBe(
      "https://registration.ev.church/kids/pre-enrolment",
    );
    for (const path of [
      "/kids",
      "../admin",
      "kids?mode=edit",
      "kids//child",
      "admin/users",
      "api/people",
      "page/433",
      "https://example.com/kids",
      "x".repeat(129),
    ]) {
      expect(validateRegistrationPagePath(path)).toBeTypeOf("string");
      expect(registrationPageHref(path)).toBeNull();
    }
  });
});
