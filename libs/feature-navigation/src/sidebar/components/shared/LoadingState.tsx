import React from 'react';

interface LoadingStateProps {
  message?: string;
}

/**
 * LoadingState Component
 * Displays an animated loading icon with optional message
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="p-2 sm:p-4 text-center flex-1 flex items-center justify-center">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            preserveAspectRatio="xMidYMid meet"
            width="100%"
            height="100%"
            viewBox="0 0 500 500"
          >
            <defs>
              <animateTransform
                repeatCount="indefinite"
                dur="3.04s"
                begin="0s"
                xlinkHref="#_R_G_L_2_G_N_1_T_0"
                fill="freeze"
                attributeName="transform"
                from="0"
                to="360"
                type="rotate"
                additive="sum"
                keyTimes="0;0.2467105;0.4473684;0.5;0.5526316;0.7368421;0.8947368;0.9473684;0.9868421;1"
                values="0;0;185;178;180;180;365;358;360;360"
                keySplines="0.8 0 0.2 1;0.8 0 0.2 1;0.8 0 0.9 1;0.8 0 0.9 1;0.8 0 0.2 1;0.8 0 0.2 1;0.167 0 0.9 1;0.167 0 0.9 1;0 0 0 0"
                calcMode="spline"
              />
              <animateTransform
                repeatCount="indefinite"
                dur="3.04s"
                begin="0s"
                xlinkHref="#_R_G_L_1_G_N_1_T_0"
                fill="freeze"
                attributeName="transform"
                from="0"
                to="360"
                type="rotate"
                additive="sum"
                keyTimes="0;0.2467105;0.4473684;0.5;0.5526316;0.7368421;0.8947368;0.9473684;0.9868421;1"
                values="0;0;185;178;180;180;365;358;360;360"
                keySplines="0.8 0 0.2 1;0.8 0 0.2 1;0.8 0 0.9 1;0.8 0 0.9 1;0.8 0 0.2 1;0.8 0 0.2 1;0.167 0 0.9 1;0.167 0 0.9 1;0 0 0 0"
                calcMode="spline"
              />
              <animateTransform
                repeatCount="indefinite"
                dur="3.04s"
                begin="0s"
                xlinkHref="#_R_G_L_0_G"
                fill="freeze"
                attributeName="transform"
                from="0"
                to="360"
                type="rotate"
                additive="sum"
                keyTimes="0;0.2467105;0.4473684;0.5;0.5526316;0.7368421;0.8947368;0.9473684;0.9868421;1"
                values="0;0;185;178;180;180;365;358;360;360"
                keySplines="0.8 0 0.2 1;0.8 0 0.2 1;0.8 0 0.9 1;0.8 0 0.9 1;0.8 0 0.2 1;0.8 0 0.2 1;0.167 0 0.9 1;0.167 0 0.9 1;0 0 0 0"
                calcMode="spline"
              />
              <animate
                attributeType="XML"
                attributeName="opacity"
                dur="3s"
                from="0"
                to="1"
                xlinkHref="#time_group"
              />
            </defs>
            <g id="_R_G">
              <g id="_R_G_L_2_G_N_1_T_0" transform=" translate(250, 250)">
                <g id="_R_G_L_2_G">
                  <path
                    id="_R_G_L_2_G_D_0_P_0"
                    fill="#886cff"
                    fillOpacity="1"
                    fillRule="nonzero"
                    d=" M82.69 36.54 C82.69,36.54 46.13,-0.21 46.13,-0.21 C46.13,-0.21 34.45,11.47 34.45,11.47 C34.45,11.47 66.17,43.38 66.17,43.38 C66.17,43.38 66.17,106.32 66.17,106.32 C66.17,106.32 -8.62,106.32 -8.62,106.32 C-8.62,106.32 -11.96,122.84 -11.96,122.84 C-11.96,122.84 82.69,122.84 82.69,122.84 C82.69,122.84 82.69,36.54 82.69,36.54z "
                  />
                  <path
                    id="_R_G_L_2_G_D_1_P_0"
                    fill="#886cff"
                    fillOpacity="1"
                    fillRule="nonzero"
                    d=" M-66.27 106.63 C-66.27,106.63 -66.27,43.7 -66.27,43.7 C-66.27,43.7 0.09,-22.66 0.09,-22.66 C0.09,-22.66 16.73,-6.02 16.73,-6.02 C16.73,-6.02 28.41,-17.7 28.41,-17.7 C28.41,-17.7 0.09,-46.03 0.09,-46.03 C0.09,-46.03 -82.79,36.85 -82.79,36.85 C-82.79,36.85 -82.79,123.15 -82.79,123.15 C-82.79,123.15 13.71,123.15 13.71,123.15 C13.71,123.15 14.76,114.88 15.79,106.63 C15.79,106.63 -66.27,106.63 -66.27,106.63z "
                  />
                </g>
              </g>
              <g id="_R_G_L_1_G_N_1_T_0" transform=" translate(250, 250)">
                <g id="_R_G_L_1_G" transform=" rotate(180)">
                  <path
                    id="_R_G_L_1_G_D_0_P_0"
                    fill="#00ddd2"
                    fillOpacity="1"
                    fillRule="nonzero"
                    d=" M82.69 36.54 C82.69,36.54 46.01,-0.08 46.01,-0.08 C46.01,-0.08 34.32,11.6 34.32,11.6 C34.32,11.6 66.17,43.38 66.17,43.38 C66.17,43.38 66.17,106.32 66.17,106.32 C66.17,106.32 -8.62,106.32 -8.62,106.32 C-8.62,106.32 -11.96,122.84 -11.96,122.84 C-11.96,122.84 82.69,122.84 82.69,122.84 C82.69,122.84 82.69,36.54 82.69,36.54z "
                  />
                  <path
                    id="_R_G_L_1_G_D_1_P_0"
                    fill="#00ddd2"
                    fillOpacity="1"
                    fillRule="nonzero"
                    d=" M-66.27 106.63 C-66.27,106.63 -66.27,43.7 -66.27,43.7 C-66.27,43.7 0.09,-22.66 0.09,-22.66 C0.09,-22.66 16.73,-6.02 16.73,-6.02 C16.73,-6.02 28.41,-17.7 28.41,-17.7 C28.41,-17.7 0.09,-46.03 0.09,-46.03 C0.09,-46.03 -82.79,36.85 -82.79,36.85 C-82.79,36.85 -82.79,123.15 -82.79,123.15 C-82.79,123.15 13.71,123.15 13.71,123.15 C13.71,123.15 14.76,114.88 15.79,106.63 C15.79,106.63 -66.27,106.63 -66.27,106.63z "
                  />
                </g>
              </g>
              <g id="_R_G_L_0_G" transform=" translate(250, 250)">
                <path
                  id="_R_G_L_0_G_D_0_P_0"
                  fill="#221d57"
                  fillOpacity="1"
                  fillRule="nonzero"
                  d=" M10.51 0 C10.51,0 0,10.51 0,10.51 C0,10.51 -10.51,0 -10.51,0 C-10.51,0 0,-10.51 0,-10.51 C0,-10.51 10.51,0 10.51,0z "
                />
              </g>
            </g>
            <g id="time_group" />
          </svg>
        </div>
        <span className="text-xs text-gray-600">{message}</span>
      </div>
    </div>
  );
};
