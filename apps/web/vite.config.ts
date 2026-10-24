import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [cloudflare()],
	build: {
		rolldownOptions: {
			// The game, plus two test pages that use three.js: the 3D character speed test (Test 1b)
			// the street test (third-person walk and okada ride, design brief 22.1) and the people test.
			input: { main: "index.html", charTest: "char-test.html", streetTest: "street-test.html", personTest: "person-test.html" },
		},
	},
});
