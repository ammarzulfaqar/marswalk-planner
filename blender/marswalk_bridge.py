"""TRAVERSE route bridge: drive the Perseverance rover along a planned Marswalk route.

Usage (Blender, Scripting tab or headless):
    blender Untitled.blend --background --python marswalk_bridge.py -- <path/to/route.json> [--speed 1.5]

route.json comes from TRAVERSE (the web planner) via the "Export route.json" button.
This v1 bridge bakes the planned drive as linear keyframes on Rover_Rig (pre-vis,
deterministic, survives save/reopen). v2 will feed the same waypoints into the live
physics driver (drive_perseverance.py) as autopilot input so the rocker-bogie
suspension physically walks the route.
"""
import json
import math
import sys

import bpy

R = 3_389_500.0          # Mars mean radius, m (IAU 2015) — same as the web planner
M_PER_DEG = math.pi * R / 180.0   # latitude metres/deg (~59,188.6)
FPS = 24
RIG_NAME = "Rover_Rig"


def argv_after_dash():
    args = sys.argv
    if "--" not in args:
        return [], {}
    rest = args[args.index("--") + 1:]
    path, speed, i = None, 1.5, 0
    while i < len(rest):
        if rest[i] == "--speed":
            speed = float(rest[i + 1]); i += 2
        elif path is None:
            path = rest[i]; i += 1
        else:
            i += 1
    return path, speed


def to_scene_xy(lon, lat, lon0, lat0, theta0):
    """Equirectangular projection around the route origin, then rotate so the first
    segment points -Y (the rover's forward direction in the course layout)."""
    east = (lon - lon0) * M_PER_DEG * math.cos(math.radians(lat0))
    north = (lat - lat0) * M_PER_DEG
    # rotate by -theta0 so route[0]->route[1] maps to (0, -1)
    c, s = math.cos(-theta0), math.sin(-theta0)
    return east * c - north * s, east * s + north * c


def main():
    path, speed_kmh = argv_after_dash()
    if not path:
        raise RuntimeError("usage: -- <route.json> [--speed 1.5]")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    route = data["route"]
    if len(route) < 2:
        raise RuntimeError("route needs >= 2 waypoints")
    lat0, lon0 = route[0]["lat"], route[0]["lon"]

    # local metre coords
    pts = []
    for wp in route:
        east = (wp["lon"] - lon0) * M_PER_DEG * math.cos(math.radians(lat0))
        north = (wp["lat"] - lat0) * M_PER_DEG
        pts.append((east, north, wp.get("elev_m")))
    # rotate so first segment points -Y (rover forward)
    e1, n1, _ = pts[1]
    theta0 = math.atan2(e1, -n1) if (abs(e1) + abs(n1)) > 1e-9 else 0.0
    c, s = math.cos(-theta0), math.sin(-theta0)
    pts = [(e * c - n * s, e * s + n * c, z) for e, n, z in pts]

    elevs = [z for _, _, z in pts if z is not None]
    dz = (sum(elevs) / len(elevs)) if elevs else 0.0

    rig = bpy.data.objects.get(RIG_NAME)
    if rig is None:
        raise RuntimeError(f"{RIG_NAME} not found — open the rover .blend first")

    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_set(1)

    speed_ms = speed_kmh / 3.6
    t = 0.0
    prev = pts[0]
    rig.keyframe_insert("location", frame=1)
    for i, (e, n, z) in enumerate(pts[1:], start=2):
        d = math.dist((prev[0], prev[1]), (e, n))
        t += d / speed_ms
        frame = max(2, round(t * FPS) + 1)
        rig.location = (e, n, (z - dz) if z is not None else 0.0)
        rig.keyframe_insert("location", frame=frame)
        print(f"WP{i}: {d:7.1f} m -> frame {frame}  "
              f"{'★ science stop' if route[i - 1].get('science_stop') else ''}")
        prev = (e, n, z)

    # make all interpolation linear (constant EVA pace)
    action = rig.animation_data.action if rig.animation_data else None
    if action:
        curves = getattr(action, "fcurves", None)
        if not curves:
            curves = [fc for layer in action.layers for strip in layer.strips
                      for bag in strip.channelbags for fc in bag.fcurves]
        for fc in curves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"

    scene.frame_end = max(scene.frame_end, round(t * FPS) + 1)
    scene.frame_set(1)
    stats = data.get("stats", {})
    print(f"Bridge baked: {stats.get('distance_km', '?')} km at {speed_kmh} km/h -> "
          f"{scene.frame_end} frames @ {FPS} fps ({scene.frame_end / FPS:.1f} s). "
          "Press Space to play the planned Marswalk.")


main()