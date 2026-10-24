import {
  TWO_SUM_BRUTE_BLOCKS,
  TWO_SUM_OPTIMIZED_BLOCKS,
} from "@/lib/gemma/fixtures/two-sum-blocks";
import { BlockStack } from "@/components/blocks/BlockStack";

export default function BlocksDemoPage() {
  return (
    <div className="min-h-screen bg-zinc-100 p-8">
      <h1 className="text-2xl font-bold mb-2">LeetBloc — Block Renderer Demo</h1>
      <p className="text-zinc-500 mb-8 text-sm">Two Sum — CSS 3D transform blocks</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Brute force */}
        <section>
          <h2 className="text-lg font-semibold mb-1">Brute Force</h2>
          <p className="text-zinc-500 text-sm mb-4">O(n²) — nested loops</p>
          <div style={{ perspective: "800px" }}>
            <div
              style={{
                transformStyle: "preserve-3d",
                transform: "rotateX(2deg) rotateY(-2deg)",
              }}
            >
              <BlockStack blocks={TWO_SUM_BRUTE_BLOCKS} />
            </div>
          </div>
        </section>

        {/* Optimized */}
        <section>
          <h2 className="text-lg font-semibold mb-1">Optimized</h2>
          <p className="text-zinc-500 text-sm mb-4">O(n) — hash map</p>
          <div style={{ perspective: "800px" }}>
            <div
              style={{
                transformStyle: "preserve-3d",
                transform: "rotateX(2deg) rotateY(-2deg)",
              }}
            >
              <BlockStack blocks={TWO_SUM_OPTIMIZED_BLOCKS} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
