import assert from "node:assert/strict";
import test from "node:test";

import {
    INITIATIVE_LIMITS,
    NON_NEGATIVE_TRACKER_LIMITS,
    POSITIVE_TRACKER_LIMITS,
    TRACKER_LIMITS,
    isPlainNumericText,
    parseBoundedNumber
} from "../.test-dist/numeric-input-limits.js";

test("initiative input limits accept boundary and fractional values but reject oversized values", () => {
    assert.equal(parseBoundedNumber("-1000000", INITIATIVE_LIMITS), -1_000_000);
    assert.equal(parseBoundedNumber("13.5", INITIATIVE_LIMITS), 13.5);
    assert.equal(parseBoundedNumber("1000000", INITIATIVE_LIMITS), 1_000_000);
    assert.equal(parseBoundedNumber("1000001", INITIATIVE_LIMITS), null);
    assert.equal(
        parseBoundedNumber("999999999999999999999999999999999999999999999999999999999999", INITIATIVE_LIMITS),
        null);
});

test("tracker limits enforce whole numbers", () => {
    assert.equal(parseBoundedNumber("-1000000000", TRACKER_LIMITS), -1_000_000_000);
    assert.equal(parseBoundedNumber("1000000000", TRACKER_LIMITS), 1_000_000_000);
    assert.equal(parseBoundedNumber("12.5", TRACKER_LIMITS), null);
});

test("non-negative and positive tracker limits enforce semantic bounds", () => {
    assert.equal(parseBoundedNumber("0", NON_NEGATIVE_TRACKER_LIMITS), 0);
    assert.equal(parseBoundedNumber("1000000000", NON_NEGATIVE_TRACKER_LIMITS), 1_000_000_000);
    assert.equal(parseBoundedNumber("-1", NON_NEGATIVE_TRACKER_LIMITS), null);
    assert.equal(parseBoundedNumber("0.5", NON_NEGATIVE_TRACKER_LIMITS), null);
    assert.equal(parseBoundedNumber("1000000001", NON_NEGATIVE_TRACKER_LIMITS), null);

    assert.equal(parseBoundedNumber("1", POSITIVE_TRACKER_LIMITS), 1);
    assert.equal(parseBoundedNumber("0", POSITIVE_TRACKER_LIMITS), null);
});


test("plain numeric input syntax rejects exponent notation and alphabetic text", () => {
    assert.equal(isPlainNumericText("17", INITIATIVE_LIMITS), true);
    assert.equal(isPlainNumericText("-2.5", INITIATIVE_LIMITS), true);
    assert.equal(isPlainNumericText("1e3", INITIATIVE_LIMITS), false);
    assert.equal(isPlainNumericText("E", INITIATIVE_LIMITS), false);
    assert.equal(isPlainNumericText("12abc", TRACKER_LIMITS), false);
    assert.equal(isPlainNumericText("12.5", TRACKER_LIMITS), false);
    assert.equal(isPlainNumericText("-4", NON_NEGATIVE_TRACKER_LIMITS), false);
});
