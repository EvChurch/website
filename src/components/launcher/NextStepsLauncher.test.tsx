// @vitest-environment happy-dom

import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/about",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/forms/RockForm", () => ({
  RockForm: ({ workflowTypeGuid }: { workflowTypeGuid: string }) => (
    <label>
      Form draft
      <input aria-label={`Workflow ${workflowTypeGuid}`} />
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

import { NextStepsLauncher } from "./NextStepsLauncher";
import { Header } from "@/components/layout/Header";
import {
  GivingExperienceProvider,
  useGivingExperience,
} from "@/components/giving/GivingExperienceProvider";
import {
  CONNECT_CARD_WORKFLOW_GUID,
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
    window.localStorage.clear();
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

    expect(toggle.isConnected).toBe(true);
    expect(toggle.getAttribute("aria-label")).toBe("Close next steps");
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

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
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
    ).toContain("right-4");
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
      "Give securely through the EV Church website",
    );
    expect(panelText).not.toContain(
      "Introduce yourself or ask us to get in touch",
    );
    expect(panelText).not.toContain(
      "Explore everything available at your campus",
    );
    expect(container.querySelector('a[href="https://give.ev.church"]')).not.toBeNull();
    expect(button(container, "Plan a Visit")?.className).toContain("py-6");
    expect(container.querySelector('a[href="https://give.ev.church"]')?.className).not.toContain(
      "py-6",
    );

    await act(async () => button(container, "Plan a Visit")?.click());
    expect(
      container.querySelector(
        `input[aria-label="Workflow ${PLAN_A_VISIT_WORKFLOW_GUID}"]`,
      ),
    ).not.toBeNull();
    expect(button(container, "Back")?.parentElement?.className).toContain(
      "left-4",
    );
    expect(
      button(container, "Open full screen")?.parentElement?.className,
    ).toContain("right-4");
    await act(async () => button(container, "Back")?.click());
    await act(async () => button(container, "Connect Card")?.click());
    expect(
      container.querySelector(
        `input[aria-label="Workflow ${CONNECT_CARD_WORKFLOW_GUID}"]`,
      ),
    ).not.toBeNull();
  });

  it("opens one private giving view from desktop, mobile, and launcher anchors only after positive enablement", async () => {
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
    await act(async () => container.querySelector<HTMLButtonElement>("[data-enable-giving]")?.click());

    const desktopGive = container.querySelector<HTMLAnchorElement>("header [data-header-give]")!;
    await act(async () => desktopGive.click());
    expect(container.querySelector("[data-giving-private]")?.textContent).toContain("Giving renderer seam");
    expect(button(container, "Back")).toBeTruthy();
    expect(button(container, "Open full screen")).toBeTruthy();
    expect(button(container, "Close next steps")).toBeTruthy();
    expect(
      container
        .querySelector('[aria-label="Next steps launcher"]')
        ?.querySelector('a[aria-label="Sign in"]'),
    ).not.toBeNull();

    await act(async () => button(container, "Back")?.click());
    const launcherGive = container.querySelector<HTMLAnchorElement>(
      '[aria-label="Next steps launcher"] a[href="https://give.ev.church"]',
    )!;
    await act(async () => launcherGive.click());
    expect(container.querySelector("[data-giving-private]")).not.toBeNull();

    await act(async () => button(container, "Back")?.click());
    const mobileGive = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[href="https://give.ev.church"]'),
    ).find((anchor) => anchor.textContent?.trim() === "Give" && !anchor.hasAttribute("data-header-give"))!;
    await act(async () => mobileGive.click());
    expect(container.querySelector("[data-giving-private]")).not.toBeNull();
  });

  it("uses the shared launcher Back control for giving history before exiting giving", async () => {
    await act(async () => root.render(
      <GivingExperienceProvider serverEligibility="production" givingExperience={<GivingHistoryProbe />}>
        <EnableGiving />
        <NextStepsLauncher campuses={campuses} items={items} />
      </GivingExperienceProvider>,
    ));
    await act(async () => container.querySelector<HTMLButtonElement>("[data-enable-giving]")?.click());
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => container.querySelector<HTMLAnchorElement>('a[href="https://give.ev.church"]')?.click());
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
        <NextStepsLauncher campuses={campuses} items={items} />
      </GivingExperienceProvider>,
    ));
    await act(async () => container.querySelector<HTMLButtonElement>("[data-enable-giving]")?.click());
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => container.querySelector<HTMLAnchorElement>('a[href="https://give.ev.church"]')?.click());
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
        <NextStepsLauncher campuses={campuses} items={items} />
      </GivingExperienceProvider>,
    ));
    await act(async () => container.querySelector<HTMLButtonElement>("[data-enable-giving]")?.click());
    await act(async () => button(container, "Open next steps")?.click());
    await act(async () => container.querySelector<HTMLAnchorElement>('a[href="https://give.ev.church"]')?.click());
    expect(container.querySelector('[data-giving-active]')?.textContent).toBe('true');
    await act(async () => button(container, "Close next steps")?.click());
    expect(container.querySelector('[data-giving-active]')?.textContent).toBe('false');
    expect(container.querySelector('[aria-label="Next steps launcher"]')).not.toBeNull();
  });

  it("preserves the real giving anchor for disabled and modified clicks", async () => {
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
    expect(give.href).toBe("https://give.ev.church/");

    const disabledClick = new MouseEvent("click", { bubbles: true, cancelable: true });
    expect(give.dispatchEvent(disabledClick)).toBe(true);
    expect(disabledClick.defaultPrevented).toBe(false);
    expect(container.querySelector("[data-giving-private]")).toBeNull();

    await act(async () => container.querySelector<HTMLButtonElement>("[data-enable-giving]")?.click());
    const modifiedClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    expect(give.dispatchEvent(modifiedClick)).toBe(true);
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
});
