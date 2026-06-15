import { describe, expect,it } from "vitest";

import {
  addEndpoint,
  EMPTY_STORE,
  getDefault,
  type NewEndpointInput,
  removeEndpoint,
  setDefault,
  updateEndpoint,
} from "../features/ai/customEndpoints";

describe("customEndpoints reducer — immutable store operations", () => {
  describe("addEndpoint — append with generated id, auto-default on empty", () => {
    it("adds first endpoint to empty store and sets it as default", () => {
      const input: NewEndpointInput = { name: "Local", url: "http://localhost:11434" };
      const result = addEndpoint(EMPTY_STORE, input);

      expect(result.store.endpoints).toHaveLength(1);
      expect(result.store.endpoints[0]?.name).toBe("Local");
      expect(result.store.endpoints[0]?.url).toBe("http://localhost:11434");
      expect(result.store.endpoints[0]?.model).toBe(null); // default when omitted
      expect(result.store.endpoints[0]?.hasKey).toBe(false); // default when omitted
      expect(result.store.defaultId).toBe(result.id);
      expect(result.id).toBeTruthy();
      expect(result.id.length).toBeGreaterThan(0);
    });

    it("generated id is stored in the endpoint", () => {
      const input: NewEndpointInput = { name: "Test", url: "http://test" };
      const result = addEndpoint(EMPTY_STORE, input);

      expect(result.store.endpoints[0]?.id).toBe(result.id);
    });

    it("adds second endpoint without changing default", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;
      const firstDefault = result1.store.defaultId;

      const input2: NewEndpointInput = { name: "Second", url: "http://second" };
      const result2 = addEndpoint(result1.store, input2);

      expect(result2.store.endpoints).toHaveLength(2);
      expect(result2.store.defaultId).toBe(firstDefault);
      expect(result2.store.defaultId).toBe(firstId);
      expect(result2.id).not.toBe(firstId);
    });

    it("honors optional model and hasKey fields when provided", () => {
      const input: NewEndpointInput = {
        name: "WithModel",
        url: "http://example",
        model: "llama3",
        hasKey: true,
      };
      const result = addEndpoint(EMPTY_STORE, input);

      expect(result.store.endpoints[0]?.model).toBe("llama3");
      expect(result.store.endpoints[0]?.hasKey).toBe(true);
    });

    it("does not mutate the input store", () => {
      const input: NewEndpointInput = { name: "Test", url: "http://test" };
      const originalLength = EMPTY_STORE.endpoints.length;

      addEndpoint(EMPTY_STORE, input);

      expect(EMPTY_STORE.endpoints).toHaveLength(originalLength);
      expect(EMPTY_STORE.defaultId).toBe(null);
    });

    it("does not mutate an existing store when adding", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const store1 = addEndpoint(EMPTY_STORE, input1).store;
      const store1Length = store1.endpoints.length;
      const store1Default = store1.defaultId;

      const input2: NewEndpointInput = { name: "Second", url: "http://second" };
      addEndpoint(store1, input2);

      expect(store1.endpoints).toHaveLength(store1Length);
      expect(store1.defaultId).toBe(store1Default);
    });
  });

  describe("setDefault — reassign default endpoint", () => {
    it("sets default to a specified id", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;

      const input2: NewEndpointInput = { name: "Second", url: "http://second" };
      const result2 = addEndpoint(result1.store, input2);
      const secondId = result2.id;

      const updated = setDefault(result2.store, secondId);

      expect(updated.defaultId).toBe(secondId);
      expect(updated.endpoints).toHaveLength(2);
      expect(updated.endpoints[0]?.id).toBe(firstId);
      expect(updated.endpoints[1]?.id).toBe(secondId);
    });

    it("is a no-op if id is not in the store", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);

      const updated = setDefault(result1.store, "nonexistent-id");

      expect(updated.defaultId).toBe(result1.store.defaultId);
    });

    it("does not mutate the input store", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);

      const input2: NewEndpointInput = { name: "Second", url: "http://second" };
      const result2 = addEndpoint(result1.store, input2);
      const secondId = result2.id;
      const originalDefault = result2.store.defaultId;

      setDefault(result2.store, secondId);

      expect(result2.store.defaultId).toBe(originalDefault);
    });
  });

  describe("updateEndpoint — shallow-merge patch into endpoint", () => {
    it("updates a field on the endpoint with the given id", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first", model: "old-model" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;

      const updated = updateEndpoint(result1.store, firstId, { model: "new-model" });

      expect(updated.endpoints[0]?.model).toBe("new-model");
      expect(updated.endpoints[0]?.name).toBe("First"); // unchanged
      expect(updated.endpoints[0]?.url).toBe("http://first"); // unchanged
    });

    it("does not affect other endpoints", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;

      const input2: NewEndpointInput = { name: "Second", url: "http://second" };
      const result2 = addEndpoint(result1.store, input2);

      const updated = updateEndpoint(result2.store, firstId, { model: "updated" });

      expect(updated.endpoints[0]?.model).toBe("updated");
      expect(updated.endpoints[1]?.model).toBe(null); // unchanged
    });

    it("is a no-op if id is not present", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);

      const updated = updateEndpoint(result1.store, "nonexistent-id", { model: "test" });

      expect(updated.endpoints).toEqual(result1.store.endpoints);
      expect(updated.defaultId).toBe(result1.store.defaultId);
    });

    it("leaves defaultId unchanged", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;
      const originalDefault = result1.store.defaultId;

      const updated = updateEndpoint(result1.store, firstId, { model: "changed" });

      expect(updated.defaultId).toBe(originalDefault);
    });

    it("does not mutate the input store", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first", model: "old" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;

      updateEndpoint(result1.store, firstId, { model: "new" });

      expect(result1.store.endpoints[0]?.model).toBe("old");
    });
  });

  describe("removeEndpoint — remove and reassign default if needed", () => {
    it("removes a non-default endpoint without changing default", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;

      const input2: NewEndpointInput = { name: "Second", url: "http://second" };
      const result2 = addEndpoint(result1.store, input2);
      const secondId = result2.id;

      const updated = removeEndpoint(result2.store, secondId);

      expect(updated.endpoints).toHaveLength(1);
      expect(updated.endpoints[0]?.id).toBe(firstId);
      expect(updated.defaultId).toBe(firstId); // unchanged (was already first)
    });

    it("removes the default endpoint and reassigns to first remaining", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;

      const input2: NewEndpointInput = { name: "Second", url: "http://second" };
      const result2 = addEndpoint(result1.store, input2);
      const secondId = result2.id;

      const swapped = setDefault(result2.store, secondId); // second is now default
      const updated = removeEndpoint(swapped, secondId); // remove the default

      expect(updated.endpoints).toHaveLength(1);
      expect(updated.endpoints[0]?.id).toBe(firstId);
      expect(updated.defaultId).toBe(firstId); // reassigned to first remaining
    });

    it("sets defaultId to null when removing the last endpoint", () => {
      const input1: NewEndpointInput = { name: "Only", url: "http://only" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const onlyId = result1.id;

      const updated = removeEndpoint(result1.store, onlyId);

      expect(updated.endpoints).toHaveLength(0);
      expect(updated.defaultId).toBeNull();
    });

    it("is a no-op if id is not present", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);

      const updated = removeEndpoint(result1.store, "nonexistent-id");

      expect(updated.endpoints).toEqual(result1.store.endpoints);
      expect(updated.defaultId).toBe(result1.store.defaultId);
    });

    it("does not mutate the input store", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;

      const input2: NewEndpointInput = { name: "Second", url: "http://second" };
      const result2 = addEndpoint(result1.store, input2);

      removeEndpoint(result2.store, firstId);

      expect(result2.store.endpoints).toHaveLength(2);
    });

    it("removes from the middle and preserves order", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;

      const input2: NewEndpointInput = { name: "Second", url: "http://second" };
      const result2 = addEndpoint(result1.store, input2);
      const secondId = result2.id;

      const input3: NewEndpointInput = { name: "Third", url: "http://third" };
      const result3 = addEndpoint(result2.store, input3);
      const thirdId = result3.id;

      const updated = removeEndpoint(result3.store, secondId);

      expect(updated.endpoints).toHaveLength(2);
      expect(updated.endpoints[0]?.id).toBe(firstId);
      expect(updated.endpoints[1]?.id).toBe(thirdId);
    });
  });

  describe("getDefault — retrieve the default endpoint or null", () => {
    it("returns the default endpoint when set", () => {
      const input1: NewEndpointInput = { name: "Default", url: "http://default" };
      const result1 = addEndpoint(EMPTY_STORE, input1);

      const defaultEndpoint = getDefault(result1.store);

      expect(defaultEndpoint).not.toBeNull();
      expect(defaultEndpoint?.id).toBe(result1.id);
      expect(defaultEndpoint?.name).toBe("Default");
      expect(defaultEndpoint?.url).toBe("http://default");
    });

    it("returns null for empty store", () => {
      const defaultEndpoint = getDefault(EMPTY_STORE);

      expect(defaultEndpoint).toBeNull();
    });

    it("returns the correct endpoint after setDefault", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);

      const input2: NewEndpointInput = { name: "Second", url: "http://second" };
      const result2 = addEndpoint(result1.store, input2);
      const secondId = result2.id;

      const swapped = setDefault(result2.store, secondId);
      const defaultEndpoint = getDefault(swapped);

      expect(defaultEndpoint?.id).toBe(secondId);
      expect(defaultEndpoint?.name).toBe("Second");
    });

    it("returns null after removing the last (default) endpoint", () => {
      const input1: NewEndpointInput = { name: "Only", url: "http://only" };
      const result1 = addEndpoint(EMPTY_STORE, input1);

      const updated = removeEndpoint(result1.store, result1.id);
      const defaultEndpoint = getDefault(updated);

      expect(defaultEndpoint).toBeNull();
    });

    it("returns the newly reassigned default after removing old default", () => {
      const input1: NewEndpointInput = { name: "First", url: "http://first" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;

      const input2: NewEndpointInput = { name: "Second", url: "http://second" };
      const result2 = addEndpoint(result1.store, input2);
      const secondId = result2.id;

      const swapped = setDefault(result2.store, secondId);
      const updated = removeEndpoint(swapped, secondId);
      const defaultEndpoint = getDefault(updated);

      expect(defaultEndpoint?.id).toBe(firstId);
    });
  });

  describe("combined workflows — realistic sequences", () => {
    it("add two, set second default, update first, remove second", () => {
      const input1: NewEndpointInput = { name: "Local", url: "http://localhost:11434" };
      const result1 = addEndpoint(EMPTY_STORE, input1);
      const firstId = result1.id;

      const input2: NewEndpointInput = { name: "Remote", url: "http://api.example.com" };
      const result2 = addEndpoint(result1.store, input2);
      const secondId = result2.id;

      let store = setDefault(result2.store, secondId);
      expect(getDefault(store)?.name).toBe("Remote");

      store = updateEndpoint(store, firstId, { model: "llama3" });
      expect(store.endpoints[0]?.model).toBe("llama3");
      expect(getDefault(store)?.name).toBe("Remote"); // still second

      store = removeEndpoint(store, secondId);
      expect(store.endpoints).toHaveLength(1);
      expect(getDefault(store)?.name).toBe("Local"); // reassigned to first
    });

    it("add three, remove middle, verify all ids intact", () => {
      const input1: NewEndpointInput = { name: "A", url: "http://a" };
      const result1 = addEndpoint(EMPTY_STORE, input1);

      const input2: NewEndpointInput = { name: "B", url: "http://b" };
      const result2 = addEndpoint(result1.store, input2);
      const bId = result2.id;

      const input3: NewEndpointInput = { name: "C", url: "http://c" };
      const result3 = addEndpoint(result2.store, input3);

      const updated = removeEndpoint(result3.store, bId);

      expect(updated.endpoints).toHaveLength(2);
      expect(updated.endpoints[0]?.name).toBe("A");
      expect(updated.endpoints[1]?.name).toBe("C");
    });
  });
});
