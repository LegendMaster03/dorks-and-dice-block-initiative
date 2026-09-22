import assert from "node:assert/strict";
import test from "node:test";

import {
    controllerRelationshipError
} from "../.test-dist/roster/controller-relationships.js";

test("accepts acyclic controller chains", () => {
    assert.equal(
        controllerRelationshipError([
            { id: "a", name: "A", controllerId: "b" },
            { id: "b", name: "B", controllerId: "c" },
            { id: "c", name: "C", controllerId: null }
        ]),
        null);
});

test("rejects direct and indirect controller cycles before API submission", () => {
    assert.match(
        controllerRelationshipError([
            { id: "a", name: "A", controllerId: "b" },
            { id: "b", name: "B", controllerId: "a" }
        ]) ?? "",
        /A → B → A/);

    assert.match(
        controllerRelationshipError([
            { id: "a", name: "A", controllerId: "b" },
            { id: "b", name: "B", controllerId: "c" },
            { id: "c", name: "C", controllerId: "a" }
        ]) ?? "",
        /A → B → C → A/);
});

test("rejects missing and self controller references", () => {
    assert.match(
        controllerRelationshipError([
            { id: "a", name: "A", controllerId: "missing" }
        ]) ?? "",
        /no longer in the encounter/);

    assert.match(
        controllerRelationshipError([
            { id: "a", name: "A", controllerId: "a" }
        ]) ?? "",
        /can not act with itself/);
});
