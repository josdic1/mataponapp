import loaderImage from "../../assets/brand/mataponi-loader-source.png";
import "./MataponiLoader.css";

export function MataponiLoader() {
  return (
    <div className="loader-overlay" role="status" aria-label="Loading">
      <svg
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
        style={{ position: "absolute" }}
      >
        <filter
          id="mataponi-green"
          colorInterpolationFilters="sRGB"
        >
          <feComponentTransfer>
            <feFuncR type="linear" slope="1" intercept="0" />
            <feFuncG type="linear" slope=".529412" intercept=".470588" />
            <feFuncB type="linear" slope=".670588" intercept=".329412" />
            <feFuncA type="identity" />
          </feComponentTransfer>
        </filter>
      </svg>

      <div className="mataponi-loader">
        <img
          className="mataponi-loader__hardware"
          src={loaderImage}
          alt=""
        />

        <div className="mataponi-loader__sign">
          <img src={loaderImage} alt="" />
        </div>
      </div>
    </div>
  );
}
