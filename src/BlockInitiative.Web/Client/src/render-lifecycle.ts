export type AfterRenderHook = () => void;
export type RenderScheduler = (callback: () => void) => void;

export interface RenderLifecycle {
    registerAfterRender(name: string, order: number, hook: AfterRenderHook): () => void;
    requestEnhancement(): void;
    afterNextEnhancement(callback: AfterRenderHook): void;
}

type HookRegistration = {
    name: string;
    order: number;
    hook: AfterRenderHook;
};

function scheduleTask(callback: () => void): void {
    globalThis.setTimeout(callback, 0);
}

export function createRenderLifecycle(scheduler: RenderScheduler = scheduleTask): RenderLifecycle {
    const hooks = new Map<string, HookRegistration>();
    let scheduled = false;
    let running = false;
    let afterPass: AfterRenderHook[] = [];

    const runPass = (): void => {
        if (!scheduled || running) return;
        scheduled = false;
        running = true;

        try {
            const ordered = [...hooks.values()].sort((left, right) =>
                left.order - right.order || left.name.localeCompare(right.name));
            for (const registration of ordered) {
                try {
                    registration.hook();
                } catch (error) {
                    console.error(`[Block Initiative] after-render hook "${registration.name}" failed.`, error);
                }
            }
        } finally {
            running = false;
            const callbacks = afterPass;
            afterPass = [];
            for (const callback of callbacks) {
                try {
                    callback();
                } catch (error) {
                    console.error("[Block Initiative] after-render completion callback failed.", error);
                }
            }
        }
    };

    const requestEnhancement = (): void => {
        // A hook requesting another pass because of its own DOM writes is the
        // observer-loop failure mode this coordinator replaces. The current
        // ordered pass is authoritative for synchronous hook work; genuinely
        // new asynchronous state will request a later pass after this one ends.
        if (running || scheduled) return;
        scheduled = true;
        scheduler(runPass);
    };

    return {
        registerAfterRender(name: string, order: number, hook: AfterRenderHook): () => void {
            if (hooks.has(name)) {
                throw new Error(`After-render hook "${name}" is already registered.`);
            }
            const registration = { name, order, hook };
            hooks.set(name, registration);
            return () => {
                if (hooks.get(name) === registration) hooks.delete(name);
            };
        },
        requestEnhancement,
        afterNextEnhancement(callback: AfterRenderHook): void {
            afterPass.push(callback);
            requestEnhancement();
        }
    };
}

const lifecycle = createRenderLifecycle();

export const registerAfterRender = lifecycle.registerAfterRender;
export const requestEnhancement = lifecycle.requestEnhancement;
export const afterNextEnhancement = lifecycle.afterNextEnhancement;


/**
 * Popovers own their transient input state. Scheduling a complete enhancement
 * on their clicks and keystrokes can detach their focused inputs mid-edit.
 * Other app inputs still schedule enhancement and persistence independently.
 */
export function shouldEnhanceForAppEvent(event: Event): boolean {
    const target = event.target;
    const element = target instanceof Element
        ? target
        : target instanceof Node
            ? target.parentElement
            : null;
    return !element?.closest(
        ".bi-condition-picker, .bi-condition-menu, .bi-hp-editor, .bi-kaiju-pool-editor");
}
