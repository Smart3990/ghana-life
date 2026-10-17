import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [cloudflare()],
	build: {
		rolldownOptions: {
			// The game, plus the 3D character speed test (Test 1b), which is the only page using three.js.
			input: { main: "index.html", charTest: "char-test.html" },
		},
	},
});
