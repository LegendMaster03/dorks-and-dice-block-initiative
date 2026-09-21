import assert from "node:assert/strict";
import test from "node:test";

import { createRenderLifecycle } from "../.test-dist/render-lifecycle.js";

function controlledLifecycle() {
    const queue = [];
    const lifecycle = createRenderLifecycle(callback => queue.push(callback));
    const flushOne = () => {
        const callback = queue.shift();
        assert.ok(callback, "expected one scheduled lifecycle pass");
        callback();
    };
    return { lifecycle, queue, flushOne };
}

test("coalesces requests and runs hooks in deterministic order", () => {
    const { lifecycle, queue, flushOne } = controlledLifecycle();
    const calls = [];
    lifecycle.registerAfterRender("later", 20, () => calls.push("later"));
    lifecycle.registerAfterRender("alpha", 10, () => calls.push("alpha"));
    lifecycle.registerAfterRender("beta", 10, () => calls.push("beta"));

    lifecycle.requestEnhancement();
    lifecycle.requestEnhancement();
    lifecycle.requestEnhancement();

    assert.equal(queue.length, 1);
    flushOne();
    assert.deepEqual(calls, ["alpha", "beta", "later"]);
    assert.equal(queue.length, 0);
});

test("a hook can not recursively schedule itself", () => {
    const { lifecycle, queue, flushOne } = controlledLifecycle();
    let passes = 0;
    lifecycle.registerAfterRender("self-trigger", 10, () => {
        passes += 1;
        lifecycle.requestEnhancement();
    });

    lifecycle.requestEnhancement();
    flushOne();

    assert.equal(passes, 1);
    assert.equal(queue.length, 0);
});

test("condition changes and initiative advancement settle without duplicate UI or handlers", () => {
    const { lifecycle, queue, flushOne } = controlledLifecycle();
    const state = {
        conditions: [],
        activeBlock: 0
    };
    const view = {
        conditionSignature: "",
        activeBlock: -1,
        controls: new Set(),
        handlerInstallations: 0,
        mutations: 0
    };

    lifecycle.registerAfterRender("condition-ui", 10, () => {
        const signature = JSON.stringify(state.conditions);
        if (view.conditionSignature !== signature) {
            view.conditionSignature = signature;
            view.mutations += 1;
            // This deliberately models the old observer feedback hazard. The
            // coordinator must not allow a hook's own DOM change to recurse.
            lifecycle.requestEnhancement();
        }
        if (view.activeBlock !== state.activeBlock) {
            view.activeBlock = state.activeBlock;
            view.mutations += 1;
            lifecycle.requestEnhancement();
        }
        if (!view.controls.has("condition-control")) {
            view.controls.add("condition-control");
            view.mutations += 1;
        }
        if (view.handlerInstallations === 0) view.handlerInstallations += 1;
    });

    lifecycle.requestEnhancement();
    flushOne();
    const initialMutations = view.mutations;
    assert.equal(queue.length, 0);

    lifecycle.requestEnhancement();
    flushOne();
    assert.equal(view.mutations, initialMutations, "unchanged state must be idempotent");
    assert.equal(view.controls.size, 1);
    assert.equal(view.handlerInstallations, 1);

    state.conditions.push({ id: "condition-1", name: "Prone" });
    lifecycle.requestEnhancement();
    flushOne();
    assert.equal(queue.length, 0, "adding a condition must settle after one pass");
    assert.equal(view.controls.size, 1);
    assert.equal(view.handlerInstallations, 1);

    state.activeBlock += 1;
    lifecycle.requestEnhancement();
    flushOne();
    assert.equal(queue.length, 0, "advancing with visible conditions must settle after one pass");
    assert.equal(view.controls.size, 1);
    assert.equal(view.handlerInstallations, 1);
});
